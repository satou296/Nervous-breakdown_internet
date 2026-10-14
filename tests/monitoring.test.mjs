// 監視（記録・数値・/api/stats）のテスト：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { Logger } from '../server/monitoring/Logger.js';
import { LokiSink } from '../server/monitoring/LokiSink.js';
import { ServerMetrics, Counter } from '../server/monitoring/ServerMetrics.js';
import { createGameServer } from '../server/index.js';
import { loadServerConfig } from '../server/config/ServerConfig.js';
import { ClientMessage, ServerMessage, encode, decode } from '../src/net/Protocol.js';

/** 書かれた記録をためるだけの行き先 */
class MemorySink {
  entries = [];
  lines = [];
  write(entry, line) {
    this.entries.push(entry);
    this.lines.push(line);
  }
}

test('記録は1行の JSON になり、下限より軽いものは捨てる', () => {
  const sink = new MemorySink();
  const logger = new Logger({ sinks: [sink], level: 'info', now: () => new Date('2026-10-14T00:00:00Z') });
  logger.debug('ignored');
  logger.info('room_created', { rooms: 1 });
  assert.equal(sink.lines.length, 1);
  assert.deepEqual(JSON.parse(sink.lines[0]), { ts: '2026-10-14T00:00:00.000Z', level: 'info', event: 'room_created', rooms: 1 });
});

test('エラーは内容と発生場所を記録し、回数を数える', () => {
  const sink = new MemorySink();
  const logger = new Logger({ sinks: [sink] });
  logger.error('dispatch_error', new Error('こわれた'));
  assert.equal(logger.errorCount, 1);
  assert.equal(sink.entries[0].message, 'こわれた');
  assert.match(sink.entries[0].stack, /Error: こわれた/);
});

test('silent にすると何も記録しないが、エラーの回数は数える', () => {
  const sink = new MemorySink();
  const logger = new Logger({ sinks: [sink], level: 'silent' });
  logger.error('http_error', new Error('x'));
  assert.equal(sink.lines.length, 0);
  assert.equal(logger.errorCount, 1);
});

test('Loki へは、ためた記録を重さごとにまとめて送る', async () => {
  const requests = [];
  const sink = new LokiSink({
    url: 'https://loki.example/loki/api/v1/push', user: '123', token: 'secret', labels: { app: 'game' },
    fetchImpl: async (url, init) => { requests.push({ url, init }); return { ok: true, status: 204 }; }
  });
  sink.write({ ts: '2026-10-14T00:00:00.000Z', level: 'info' }, 'a');
  sink.write({ ts: '2026-10-14T00:00:01.000Z', level: 'error' }, 'b');
  sink.write({ ts: '2026-10-14T00:00:02.000Z', level: 'info' }, 'c');
  await sink.close();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.headers.Authorization, `Basic ${Buffer.from('123:secret').toString('base64')}`);
  const { streams } = JSON.parse(requests[0].init.body);
  assert.deepEqual(streams, [
    { stream: { app: 'game', level: 'info' }, values: [['1791936000000000000', 'a'], ['1791936002000000000', 'c']] },
    { stream: { app: 'game', level: 'error' }, values: [['1791936001000000000', 'b']] }
  ]);

  await sink.flush();
  assert.equal(requests.length, 1, 'たまっていなければ送らない');
});

test('Loki に送れなくても例外にならず、知らせるのは最初の1回だけ', async () => {
  const errors = [];
  const sink = new LokiSink({
    url: 'https://loki.example/push', labels: {}, maxBuffered: 2,
    fetchImpl: async () => ({ ok: false, status: 500 }),
    onError: err => errors.push(err.message)
  });
  for (const line of ['a', 'b', 'c']) sink.write({ ts: '2026-10-14T00:00:00.000Z', level: 'info' }, line);
  await sink.flush();
  sink.write({ ts: '2026-10-14T00:00:00.000Z', level: 'info' }, 'd');
  await sink.close();
  assert.equal(errors.length, 1);
});

test('数値：現在の値と累計をまとめて返す', () => {
  let now = 1000;
  const metrics = new ServerMetrics({
    gauges: () => ({ connections: 2, rooms: 1 }), errorCount: () => 3, now: () => now, memoryRss: () => 4096
  });
  metrics.count(Counter.RoomsCreated);
  metrics.count(Counter.RoomsCreated);
  now = 61_000;
  assert.deepEqual(metrics.snapshot(), {
    status: 'ok', uptimeSec: 60, connections: 2, rooms: 1,
    connectionsTotal: 0, roomsCreatedTotal: 2, matchesStartedTotal: 0, matchesFinishedTotal: 0,
    errorsTotal: 3, memoryRssBytes: 4096
  });
});

async function startServer(env = {}) {
  const config = { ...loadServerConfig({ PORT: '0', LOG_LEVEL: 'silent', ...env }), port: 0 };
  const server = createGameServer(config);
  await server.listen();
  return { server, base: `http://127.0.0.1:${server.httpServer.address().port}` };
}

const STATS_TOKEN = 'himitsu';
const readStats = base => fetch(`${base}/api/stats`, { headers: { Authorization: `Bearer ${STATS_TOKEN}` } });

test('/api/stats：部屋を作ると、接続数・部屋数・累計に反映される', async () => {
  const { server, base } = await startServer({ STATS_TOKEN });
  try {
    const before = await readStats(base).then(r => r.json());
    assert.equal(before.status, 'ok');
    assert.equal(before.connections, 0);
    assert.equal(before.rooms, 0);

    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`, { origin: base });
    await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
    const joined = new Promise(resolve => ws.on('message', data => {
      if (decode(data.toString())?.type === ServerMessage.RoomJoined) resolve();
    }));
    ws.send(encode(ClientMessage.CreateRoom, { name: 'ホスト', difficultyId: 'normal', deckSize: 20 }));
    await joined;

    const after = await readStats(base).then(r => r.json());
    assert.equal(after.connections, 1);
    assert.equal(after.connectionsTotal, 1);
    assert.equal(after.rooms, 1);
    assert.equal(after.roomsPlaying, 0);
    assert.equal(after.players, 1);
    assert.equal(after.roomsCreatedTotal, 1);
    assert.equal(JSON.stringify(after).includes('ホスト'), false, '名前は外に出さない');
    ws.close();
  } finally {
    await server.close();
  }
});

test('/api/stats：合言葉なし・違う合言葉では見られない（/health はそのまま見られる）', async () => {
  const { server, base } = await startServer({ STATS_TOKEN });
  try {
    assert.equal((await fetch(`${base}/api/stats`)).status, 401);
    assert.equal((await fetch(`${base}/api/stats`, { headers: { Authorization: 'Bearer chigau' } })).status, 401);
    assert.equal((await fetch(`${base}/api/stats?token=${STATS_TOKEN}`)).status, 401, 'URL に付けた合言葉は受け付けない');
    const ok = await readStats(base);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).status, 'ok');
    assert.equal((await fetch(`${base}/health`)).status, 200);
  } finally {
    await server.close();
  }
});

test('/api/stats：合言葉が未設定なら、入口そのものを閉じる', async () => {
  const { server, base } = await startServer();
  try {
    assert.equal((await fetch(`${base}/api/stats`)).status, 404);
    assert.equal((await fetch(`${base}/api/stats`, { headers: { Authorization: 'Bearer ' } })).status, 404);
    assert.equal((await fetch(`${base}/health`)).status, 200);
  } finally {
    await server.close();
  }
});

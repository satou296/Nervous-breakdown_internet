// オンライン対戦（サーバーの判定・部屋・通信）のテスト：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { OnlineMatch, MatchEvent } from '../server/match/OnlineMatch.js';
import { OriginPolicy } from '../server/net/OriginPolicy.js';
import { RateLimiter, KeyedRateLimiter } from '../server/net/RateLimiter.js';
import { ConnectionGate, GateRejection } from '../server/net/ConnectionGate.js';
import { resolveClientAddress, forwardedEntryCount } from '../server/net/ClientAddress.js';
import { validateClientMessage, ValidationError } from '../server/net/MessageValidator.js';
import { RoomCodeGenerator } from '../server/rooms/RoomCodeGenerator.js';
import { createGameServer } from '../server/index.js';
import { loadServerConfig } from '../server/config/ServerConfig.js';
import { DeckFactory } from '../src/domain/DeckFactory.js';
import { SameRankRule } from '../src/domain/MatchRule.js';
import { ConcentrationGame, GameEvent } from '../src/domain/ConcentrationGame.js';
import { Player } from '../src/domain/Player.js';
import { GameStats } from '../src/domain/GameStats.js';
import { createRandom, deriveSeed } from '../src/core/random.js';
import { ServerClock } from '../src/online/ServerClock.js';
import { ClientMessage, ServerMessage, ErrorCode, encode, decode } from '../src/net/Protocol.js';
import { DECK_OPTIONS, TIMING } from '../src/config/GameConfig.js';

/** 時間を手で進められる偽のスケジューラ */
class FakeScheduler {
  now = 0;
  tasks = [];
  after(ms, fn) {
    const task = { due: this.now + ms, fn, cancelled: false };
    this.tasks.push(task);
    return () => { task.cancelled = true; };
  }
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      const next = this.tasks.filter(t => !t.cancelled && t.due <= end).sort((a, b) => a.due - b.due)[0];
      if (!next) break;
      this.now = next.due;
      next.cancelled = true;
      next.fn();
    }
    this.now = end;
  }
  cancelAll() { this.tasks.forEach(t => { t.cancelled = true; }); }
}

const identity = { shuffle: a => [...a] };

function makeMatch({ turnTimeoutMs = 30000 } = {}) {
  const scheduler = new FakeScheduler();
  const match = new OnlineMatch({
    playerNames: ['A', 'B'], difficultyId: 'normal', deckSize: 20,
    deckFactory: new DeckFactory(identity), deckOptions: DECK_OPTIONS, matchRule: new SameRankRule(),
    timing: TIMING, scheduler, turnTimeoutMs, disconnectGraceMs: 5000, now: () => scheduler.now, seed: 42
  });
  const sent = [];
  match.on(MatchEvent.Outbound, m => sent.push(m));
  match.start();
  scheduler.advance(TIMING.dealSettleMs);
  return { match, scheduler, sent, last: type => sent.filter(m => m.type === type).at(-1) };
}

test('山札の番号からは、カードの中身が分からない（シャッフル後に番号を振る）', () => {
  const deck = new DeckFactory({ shuffle: a => [...a].reverse() }).create(2);
  assert.deepEqual(deck.map(c => c.id), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(deck[0].rank, 2, '番号0が A ではない');
});

test('同じ種なら、同じ乱数の並びになる（全員の画面のカードの動きがそろう）', () => {
  const a = createRandom(deriveSeed(123, 5));
  const b = createRandom(deriveSeed(123, 5));
  const c = createRandom(deriveSeed(123, 6));
  const seq = r => [r(), r(), r()];
  assert.deepEqual(seq(a), seq(b));
  assert.notDeepEqual(seq(createRandom(deriveSeed(123, 5))), seq(c));
});

test('手番を飛ばすと、めくりかけのカードは裏に戻り次の人へ', () => {
  const cards = new DeckFactory(identity).create(2);
  const players = [new Player({ name: 'A' }), new Player({ name: 'B' })];
  const game = new ConcentrationGame({ cards, players, matchRule: new SameRankRule(), stats: new GameStats(() => 0) });
  const cancelled = [];
  game.on(GameEvent.SelectionCancelled, e => cancelled.push(...e.cards));
  game.start();
  game.select(cards[0]);
  assert.equal(game.passTurn(), true);
  assert.equal(cards[0].isSelectable, true);
  assert.deepEqual(cancelled, [cards[0]]);
  assert.equal(game.currentPlayer, players[1]);
});

test('サーバー：手番の人だけが選べ、めくったカードの中身はその時に送られる', () => {
  const { match, last } = makeMatch();
  assert.throws(() => match.select(1, 0), /あなたの番ではありません/);
  match.select(0, 0);
  const revealed = last(ServerMessage.CardRevealed);
  assert.equal(revealed.payload.cardId, 0);
  assert.equal(revealed.payload.rank, 1);
  assert.throws(() => match.select(0, 0), /選べません/, '同じカードは2回選べない');
});

test('サーバー：ペアなら得点して続けて、外れたら次の人へ', () => {
  const { match, scheduler, last } = makeMatch();
  match.select(0, 0); match.select(0, 1); // A♠ と A♥（並べ替えなし）
  scheduler.advance(TIMING.resolveDelayMs);
  assert.equal(last(ServerMessage.PairResolved).payload.matched, true);
  scheduler.advance(TIMING.matchCollectDelayMs);
  assert.deepEqual(last(ServerMessage.PairSettled).payload.state.scores, [1, 0]);
  assert.equal(last(ServerMessage.TurnStarted).payload.playerIndex, 0, 'ペアなら同じ人が続ける');

  match.select(0, 2); match.select(0, 4); // A と 2
  scheduler.advance(TIMING.resolveDelayMs + TIMING.missHideDelayMs);
  assert.equal(last(ServerMessage.PairSettled).payload.matched, false);
  assert.equal(last(ServerMessage.TurnStarted).payload.playerIndex, 1);
});

test('サーバー：持ち時間が切れたら自動で次の人へ。切断中の人はすぐ飛ばす', () => {
  const { match, scheduler, last } = makeMatch({ turnTimeoutMs: 10000 });
  match.select(0, 0);
  scheduler.advance(10000);
  assert.ok(last(ServerMessage.SelectionCancelled), 'めくりかけは裏に戻る');
  const turn = last(ServerMessage.TurnStarted).payload;
  assert.equal(turn.playerIndex, 1);
  assert.equal(turn.passed, true);

  match.setConnected(1, false);
  scheduler.advance(5000);
  assert.equal(last(ServerMessage.TurnStarted).payload.playerIndex, 0);
});

test('サーバー：再接続用の情報には、表になっているカードの中身だけが入る', () => {
  const { match } = makeMatch();
  match.select(0, 3);
  const info = match.startInfoFor(1);
  assert.equal(info.youIndex, 1);
  assert.equal(info.deck.length, 20);
  assert.deepEqual(info.snapshot.selection, [{ cardId: 3, rank: 1, suit: 3, slot: 0 }]);
  assert.equal(JSON.stringify(info).includes('"rank":2'), false, '裏向きのカードの中身は送らない');
});

test('入力の検証：知らない種類・壊れた値・長すぎる名前を正しく扱う', () => {
  assert.throws(() => validateClientMessage('hack', {}), ValidationError);
  assert.throws(() => validateClientMessage(ClientMessage.SelectCard, { cardId: 'x' }), ValidationError);
  assert.throws(() => validateClientMessage(ClientMessage.CreateRoom, { name: 'a', difficultyId: 'god', deckSize: 20 }), ValidationError);
  const created = validateClientMessage(ClientMessage.CreateRoom, { name: '  とても長い名前ですとても長い名前です  ', difficultyId: 'hard', deckSize: 32 });
  assert.equal(created.name.length, 16);
  const presence = validateClientMessage(ClientMessage.Presence, { dir: [3, 0, 4], reach: 99 });
  assert.ok(Math.abs(Math.hypot(...presence.dir) - 1) < 1e-9, '向きは長さ1に収める');
  assert.ok(presence.reach <= 9.5);
  for (const type of ['__proto__', 'constructor', 'valueOf', 'toString']) {
    assert.throws(() => validateClientMessage(type, {}), ValidationError, `${type} は知らない種類として断る`);
  }
  for (const bad of [{ difficultyId: 'constructor', deckSize: 20 }, { difficultyId: 'normal', deckSize: 'constructor' }, { difficultyId: 'normal', deckSize: '20' }]) {
    assert.throws(() => validateClientMessage(ClientMessage.CreateRoom, { name: 'a', ...bad }), ValidationError);
  }
  assert.equal(decode('not json'), null);
  assert.deepEqual(decode(encode('x', { a: 1 })), { type: 'x', payload: { a: 1 } });
});

test('接続元の確認と回数制限', () => {
  const same = new OriginPolicy({});
  assert.equal(same.isAllowed('https://game.example.com', 'game.example.com'), true);
  assert.equal(same.isAllowed('https://evil.example', 'game.example.com'), false);
  assert.equal(same.isAllowed(undefined, 'game.example.com'), false);
  let t = 0;
  const limiter = new RateLimiter({ perSecond: 2, burst: 2, now: () => t });
  assert.equal(limiter.tryTake(), true);
  assert.equal(limiter.tryTake(), true);
  assert.equal(limiter.tryTake(), false);
  t += 1000;
  assert.equal(limiter.tryTake(), true);
});

test('住所ごとの回数制限は、満タンに戻った住所を忘れる', () => {
  let t = 0;
  const limiter = new KeyedRateLimiter({ perSecond: 1, burst: 2, now: () => t });
  assert.equal(limiter.canTake('a'), true, '初めての住所は使える');
  assert.equal(limiter.tryTake('a'), true);
  assert.equal(limiter.tryTake('a'), true);
  assert.equal(limiter.canTake('a'), false);
  assert.equal(limiter.canTake('b'), true, 'ほかの住所には影響しない');
  t += 2000;
  limiter.sweep();
  assert.equal(limiter.size, 0);
});

test('接続元の住所：中継の段数に合わせて X-Forwarded-For を読み、内部の住所は数えない', () => {
  const req = (remoteAddress, xff) => ({ socket: { remoteAddress }, headers: xff === undefined ? {} : { 'x-forwarded-for': xff } });
  assert.equal(resolveClientAddress(req('203.0.113.7')), '203.0.113.7');
  assert.equal(resolveClientAddress(req('::ffff:203.0.113.7')), '203.0.113.7');
  assert.equal(resolveClientAddress(req('127.0.0.1')), null, '手元');
  assert.equal(resolveClientAddress(req('10.1.2.3')), null, '内部の住所（中継の住所を拾っている）');
  assert.equal(resolveClientAddress(req('2001:db8:1:2:aaaa::1')), '2001:db8:1:2::/64', 'IPv6 は /64 で1人');
  assert.equal(resolveClientAddress(req('2001:db8:1:2:bbbb::9')), '2001:db8:1:2::/64');

  // 利用者が自分で書いた住所（左側）は信用せず、中継が書き足した位置を読む
  const hops = n => ({ trustProxyHops: n });
  assert.equal(resolveClientAddress(req('10.0.0.1', '6.6.6.6, 198.51.100.4'), hops(1)), '198.51.100.4');
  assert.equal(resolveClientAddress(req('10.0.0.1', '6.6.6.6, 198.51.100.4, 10.0.0.9'), hops(2)), '198.51.100.4');
  assert.equal(resolveClientAddress(req('10.0.0.1', '198.51.100.4'), hops(2)), null, '件数が足りなければ分からない');
  assert.equal(resolveClientAddress(req('10.0.0.1', 'こわれた値'), hops(1)), null);
  assert.equal(resolveClientAddress(req('10.0.0.1'), hops(1)), null);
  assert.equal(forwardedEntryCount(req('10.0.0.1', '6.6.6.6, 198.51.100.4')), 2);
  assert.equal(forwardedEntryCount(req('10.0.0.1')), 0);
});

test('接続数の上限：全体と住所ごと。住所が分からない接続は全体だけで数える', () => {
  const gate = new ConnectionGate({ maxConnections: 4, maxPerAddress: 2 });
  assert.equal(gate.admit('203.0.113.1'), null);
  assert.equal(gate.admit('203.0.113.1'), null);
  assert.equal(gate.admit('203.0.113.1'), GateRejection.PerAddress);
  assert.equal(gate.admit(null), null);
  assert.equal(gate.admit(null), null);
  assert.deepEqual(gate.stats(), { clientAddresses: 1, connectionsUnidentified: 2 });
  assert.equal(gate.admit('203.0.113.2'), GateRejection.Total);
  gate.release('203.0.113.1');
  assert.equal(gate.admit('203.0.113.2'), null, '1つ空けば入れる');
  gate.release('203.0.113.1');
  gate.release('203.0.113.2');
  gate.release(null);
  gate.release(null);
  assert.deepEqual(gate.stats(), { clientAddresses: 0, connectionsUnidentified: 0 });
});

test('部屋番号は決まった文字だけで、重複しない', () => {
  const taken = new Set(['AAAAA']);
  let calls = 0;
  const gen = new RoomCodeGenerator({ randomIndex: n => (calls++ < 5 ? 0 : 1 % n) });
  const code = gen.next(c => taken.has(c));
  assert.match(code, /^[A-Z2-9]{5}$/);
  assert.notEqual(code, 'AAAAA');
});

test('サーバーの時計の推定は、往復の半分を足して求める', () => {
  let now = 1000;
  const clock = new ServerClock({ now: () => now });
  now = 1100; // 100ms で往復
  clock.addSample({ t: 1000, serverNow: 5050 });
  assert.equal(clock.now(), 5100);
});

/* ---------------- 実際にサーバーを起動して、2人で通信する ---------------- */

function connectClient(port, { headers } = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}`, headers });
  const inbox = [];
  const waiters = [];
  ws.on('message', data => {
    const m = decode(data.toString());
    inbox.push(m);
    waiters.splice(0).forEach(w => w());
  });
  const client = {
    ws,
    send: (type, payload) => ws.send(encode(type, payload)),
    async next(type, timeoutMs = 6000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const i = inbox.findIndex(m => m.type === type);
        if (i >= 0) return inbox.splice(i, 1)[0].payload;
        if (Date.now() > deadline) throw new Error(`${type} が届きませんでした`);
        await new Promise(r => { waiters.push(r); setTimeout(r, 50); });
      }
    }
  };
  return new Promise((resolve, reject) => { ws.on('open', () => resolve(client)); ws.on('error', reject); });
}

test('サーバー起動：部屋を作って招待で参加し、対戦を始めてカードをめくれる', async () => {
  const config = { ...loadServerConfig({ PORT: '0', LOG_LEVEL: 'silent' }), port: 0 };
  const server = createGameServer(config);
  await server.listen();
  const { port } = server.httpServer.address();
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`).then(r => r.json());
    assert.equal(health.status, 'ok');
    const inviteRes = await fetch(`http://127.0.0.1:${port}/room/abcde`, { redirect: 'manual' });
    assert.equal(inviteRes.status, 302, '招待URLはトップへ転送する');
    assert.equal(inviteRes.headers.get('location'), '/?room=ABCDE');
    assert.equal((await fetch(`http://127.0.0.1:${port}/server/index.js`)).status, 404, 'サーバーのコードは配信しない');

    const host = await connectClient(port);
    host.send(ClientMessage.CreateRoom, { name: 'ホスト', difficultyId: 'normal', deckSize: 20 });
    const created = await host.next(ServerMessage.RoomJoined);
    assert.match(created.code, /^[A-Z2-9]{5}$/);

    const guest = await connectClient(port);
    guest.send(ClientMessage.JoinRoom, { code: created.code, name: 'ゲスト' });
    const joined = await guest.next(ServerMessage.RoomJoined);
    assert.equal(joined.you.index, 1);

    guest.send(ClientMessage.StartMatch, {});
    assert.equal((await guest.next(ServerMessage.Error)).code, ErrorCode.NotHost);

    host.send(ClientMessage.StartMatch, {});
    const [hostStart, guestStart] = await Promise.all([host.next(ServerMessage.MatchStarted), guest.next(ServerMessage.MatchStarted)]);
    assert.equal(hostStart.seed, guestStart.seed, '全員に同じ種が配られる');
    assert.equal(hostStart.youIndex, 0);
    assert.equal(guestStart.youIndex, 1);
    await host.next(ServerMessage.TurnStarted);

    host.send(ClientMessage.SelectCard, { cardId: hostStart.deck[0] });
    const seen = await guest.next(ServerMessage.CardRevealed);
    assert.equal(seen.cardId, hostStart.deck[0]);
    assert.ok(seen.rank >= 1 && seen.rank <= 5);

    host.send(ClientMessage.Presence, { dir: [0, 0, -1], reach: 2 });
    const presence = await guest.next(ServerMessage.Presence);
    assert.equal(presence.playerIndex, 0);

    // ゲストが切れて戻ってくると、同じ席に戻り、場の状態を受け取れる
    guest.ws.close();
    await host.next(ServerMessage.PlayerStatus);
    const back = await connectClient(port);
    back.send(ClientMessage.JoinRoom, { code: created.code, name: 'ゲスト', token: joined.you.token });
    assert.equal((await back.next(ServerMessage.RoomJoined)).you.index, 1);
    const restored = await back.next(ServerMessage.MatchStarted);
    assert.equal(restored.snapshot.selection[0].cardId, hostStart.deck[0]);

    host.ws.close();
    back.ws.close();
  } finally {
    await server.close();
  }
});

test('サーバー起動：おかしなメッセージや1接続からの連打で、サーバーを落としたり部屋・席を埋めたりできない', async () => {
  const config = { ...loadServerConfig({ PORT: '0', LOG_LEVEL: 'silent' }), port: 0, maxRooms: 3 };
  const server = createGameServer(config);
  await server.listen();
  const { port } = server.httpServer.address();
  const roomCount = async () => (await fetch(`http://127.0.0.1:${port}/health`).then(r => r.json())).rooms;
  try {
    // Object.prototype にある名前の種類を送っても、エラーが返るだけでサーバーは動き続ける
    const attacker = await connectClient(port);
    for (const t of ['__proto__', 'valueOf', 'constructor']) {
      attacker.ws.send(JSON.stringify({ t, d: {} }));
      assert.equal((await attacker.next(ServerMessage.Error)).code, ErrorCode.InvalidMessage);
    }

    // 部屋を作っては抜けるのを繰り返しても、残るのは今いる1部屋だけ
    for (let i = 0; i < 6; i++) {
      attacker.send(ClientMessage.CreateRoom, { name: 'x', difficultyId: 'normal', deckSize: 20 });
      await attacker.next(ServerMessage.RoomJoined);
    }
    assert.equal(await roomCount(), 1);
    attacker.send(ClientMessage.LeaveRoom, {});
    await new Promise(r => setTimeout(r, 50));
    assert.equal(await roomCount(), 0, '誰も戻れない部屋はすぐ片付ける');

    // 1接続から同じ部屋に何度参加しても席は1つ。友だちは入れる
    const host = await connectClient(port);
    host.send(ClientMessage.CreateRoom, { name: 'ホスト', difficultyId: 'normal', deckSize: 20 });
    const { code } = await host.next(ServerMessage.RoomJoined);
    for (let i = 0; i < 4; i++) {
      attacker.send(ClientMessage.JoinRoom, { code, name: 'x' });
      assert.equal((await attacker.next(ServerMessage.RoomJoined)).you.index, 1);
    }
    const friend = await connectClient(port);
    friend.send(ClientMessage.JoinRoom, { code, name: '友だち' });
    const joined = await friend.next(ServerMessage.RoomJoined);
    assert.equal(joined.you.index, 2);
    assert.equal(joined.room.players.length, 3);

    [attacker, host, friend].forEach(c => c.ws.close());
  } finally {
    await server.close();
  }
});

test('サーバー起動：待合室でホストが戻らなければ次の人がホストになり、残った人で始められる', async () => {
  const config = { ...loadServerConfig({ PORT: '0', LOG_LEVEL: 'silent' }), port: 0, lobbySeatGraceMs: 400 };
  const server = createGameServer(config);
  await server.listen();
  const { port } = server.httpServer.address();
  try {
    const host = await connectClient(port);
    host.send(ClientMessage.CreateRoom, { name: 'ホスト', difficultyId: 'normal', deckSize: 20 });
    const created = await host.next(ServerMessage.RoomJoined);
    const guests = [];
    for (const name of ['ゲスト1', 'ゲスト2']) {
      const guest = await connectClient(port);
      guest.send(ClientMessage.JoinRoom, { code: created.code, name });
      await guest.next(ServerMessage.RoomJoined);
      guests.push(guest);
    }

    // 読み込み直し（すぐ戻る）なら、ホストのまま同じ席に戻れる
    host.ws.close();
    const back = await connectClient(port);
    back.send(ClientMessage.JoinRoom, { code: created.code, name: 'ホスト', token: created.you.token });
    const rejoined = await back.next(ServerMessage.RoomJoined);
    assert.equal(rejoined.you.index, 0);
    assert.equal(rejoined.room.hostIndex, 0);

    // タブを閉じたまま戻らなければ、席が空いてゲスト1がホストになる
    back.ws.close();
    const promoted = await guests[0].next(ServerMessage.RoomJoined, 5000);
    assert.equal(promoted.you.index, 0);
    assert.equal(promoted.room.hostIndex, 0);
    assert.deepEqual(promoted.room.players.map(p => p.name), ['ゲスト1', 'ゲスト2']);

    guests[0].send(ClientMessage.StartMatch, {});
    await Promise.all(guests.map(g => g.next(ServerMessage.MatchStarted)));

    guests.forEach(g => g.ws.close());
  } finally {
    await server.close();
  }
});

/* ---------------- 接続数の上限と、部屋番号の総当たり対策 ---------------- */

/** Render のように、中継が1段 X-Forwarded-For を書き足す構成でサーバーを立てる */
async function startLimitedServer(overrides = {}) {
  const config = {
    ...loadServerConfig({ PORT: '0', LOG_LEVEL: 'silent', TRUST_PROXY_HOPS: '1' }),
    port: 0, maxConnections: 5, maxConnectionsPerAddress: 2, ...overrides
  };
  const server = createGameServer(config);
  await server.listen();
  const { port } = server.httpServer.address();
  const from = (ip, spoofed) => connectClient(port, { headers: { 'X-Forwarded-For': spoofed ? `${spoofed}, ${ip}` : ip } });
  const stats = () => fetch(`http://127.0.0.1:${port}/api/stats`, { headers: { Authorization: 'Bearer t' } }).then(r => r.json());
  return { server, port, from, stats };
}

const closed = client => new Promise(resolve => {
  if (client.ws.readyState === WebSocket.CLOSED) resolve();
  else client.ws.on('close', resolve);
});

test('サーバー起動：同じ住所からつなげる数には上限があり、ほかの住所の人は入れる。左側に書いた住所ではすり抜けられない', async () => {
  const { server, from, stats } = await startLimitedServer({ statsToken: 't' });
  try {
    const a1 = await from('203.0.113.1');
    const a2 = await from('203.0.113.1');
    const a3 = await from('203.0.113.1');
    assert.equal((await a3.next(ServerMessage.Error)).code, ErrorCode.ServerBusy);
    await closed(a3);

    const spoof = await from('203.0.113.1', '198.51.100.99');
    assert.equal((await spoof.next(ServerMessage.Error)).code, ErrorCode.ServerBusy, '自分で書いた住所は使われない');
    await closed(spoof);

    const b = await from('203.0.113.2');
    b.send(ClientMessage.Ping, { t: 1 });
    await b.next(ServerMessage.Pong);

    a1.ws.close();
    await closed(a1);
    await new Promise(r => setTimeout(r, 50));
    const again = await from('203.0.113.1');
    again.send(ClientMessage.Ping, { t: 1 });
    await again.next(ServerMessage.Pong);

    const s = await stats();
    assert.equal(s.connectionsRejectedTotal, 2);
    assert.equal(s.clientAddresses, 2);
    assert.equal(JSON.stringify(s).includes('203.0.113'), false, '住所は外に出さない');
    [a2, b, again].forEach(c => c.ws.close());
  } finally {
    await server.close();
  }
});

test('サーバー起動：全体の接続数にも上限があり、住所が分からない接続も数える', async () => {
  const { server, port } = await startLimitedServer({ maxConnections: 2, trustProxyHops: 0 });
  try {
    const c1 = await connectClient(port);
    const c2 = await connectClient(port);
    const c3 = await connectClient(port);
    assert.equal((await c3.next(ServerMessage.Error)).code, ErrorCode.ServerBusy);
    await closed(c3);
    [c1, c2].forEach(c => c.ws.close());
  } finally {
    await server.close();
  }
});

test('サーバー起動：部屋番号を外し続けると受け付けなくなる。つなぎ直しても同じ住所なら続けられない', async () => {
  const { server, from } = await startLimitedServer({ joinMissLimit: { perSecond: 0.001, burst: 3 } });
  try {
    const host = await from('203.0.113.10');
    host.send(ClientMessage.CreateRoom, { name: 'ホスト', difficultyId: 'normal', deckSize: 20 });
    const { code } = await host.next(ServerMessage.RoomJoined);

    const guesser = await from('203.0.113.66');
    for (const guess of ['AAAAA', 'BBBBB', 'CCCCC']) {
      guesser.send(ClientMessage.JoinRoom, { code: guess, name: 'x' });
      assert.equal((await guesser.next(ServerMessage.Error)).code, ErrorCode.RoomNotFound);
    }
    guesser.send(ClientMessage.JoinRoom, { code, name: 'x' });
    assert.equal((await guesser.next(ServerMessage.Error)).code, ErrorCode.RateLimited, '正しい番号でも、外しすぎた後は入れない');

    guesser.ws.close();
    await closed(guesser);
    const retry = await from('203.0.113.66');
    retry.send(ClientMessage.JoinRoom, { code: 'DDDDD', name: 'x' });
    assert.equal((await retry.next(ServerMessage.Error)).code, ErrorCode.RateLimited);

    // 招待された人（ほかの住所）は、番号を1回で入れる
    const friend = await from('203.0.113.20');
    friend.send(ClientMessage.JoinRoom, { code, name: '友だち' });
    assert.equal((await friend.next(ServerMessage.RoomJoined)).you.index, 1);
    [host, retry, friend].forEach(c => c.ws.close());
  } finally {
    await server.close();
  }
});

test('サーバー起動：同じ住所から部屋を作れる回数には上限がある', async () => {
  const { server, from } = await startLimitedServer({ roomCreateLimit: { perSecond: 0.001, burst: 2 } });
  try {
    const maker = await from('203.0.113.30');
    for (let i = 0; i < 2; i++) {
      maker.send(ClientMessage.CreateRoom, { name: 'x', difficultyId: 'normal', deckSize: 20 });
      await maker.next(ServerMessage.RoomJoined);
    }
    maker.send(ClientMessage.CreateRoom, { name: 'x', difficultyId: 'normal', deckSize: 20 });
    assert.equal((await maker.next(ServerMessage.Error)).code, ErrorCode.RateLimited);

    const other = await from('203.0.113.31');
    other.send(ClientMessage.CreateRoom, { name: 'y', difficultyId: 'normal', deckSize: 20 });
    await other.next(ServerMessage.RoomJoined);
    [maker, other].forEach(c => c.ws.close());
  } finally {
    await server.close();
  }
});

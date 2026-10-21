/**
 * ゲームサーバーの組み立て（コンポジションルート）。
 * 1つのプロセスで「画面ファイルの配信」「/health」「WebSocket（/ws）」をまとめて受け持つ。
 * Render では PORT 環境変数のポートで待ち受ける。HTTPS は Render 側が担当する。
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';

import { loadServerConfig } from './config/ServerConfig.js';
import { StaticFileServer } from './http/StaticFileServer.js';
import { HttpRouter } from './http/HttpRouter.js';
import { OriginPolicy } from './net/OriginPolicy.js';
import { ClientConnection } from './net/ClientConnection.js';
import { MessageDispatcher } from './net/MessageDispatcher.js';
import { ConnectionGate } from './net/ConnectionGate.js';
import { RoomAccessLimiter } from './net/RoomAccessLimiter.js';
import { resolveClientAddress, forwardedEntryCount } from './net/ClientAddress.js';
import { RoomManager } from './rooms/RoomManager.js';
import { RoomCodeGenerator } from './rooms/RoomCodeGenerator.js';
import { OnlineMatch, MatchEvent } from './match/OnlineMatch.js';
import { TimerScheduler } from './match/TimerScheduler.js';
import { Logger, ConsoleSink } from './monitoring/Logger.js';
import { LokiSink } from './monitoring/LokiSink.js';
import { ServerMetrics, Counter } from './monitoring/ServerMetrics.js';

import { SOCKET_PATH, LIMITS, ServerMessage, ErrorCode, encode } from '../src/net/Protocol.js';
import { DeckFactory } from '../src/domain/DeckFactory.js';
import { FisherYatesShuffler } from '../src/domain/Shuffler.js';
import { SameRankRule } from '../src/domain/MatchRule.js';
import { DECK_OPTIONS, TIMING } from '../src/config/GameConfig.js';

/** 記録の行き先を設定から組み立てる（標準出力は常に。Loki は送り先が設定されているときだけ） */
function createLogger(config) {
  const sinks = [new ConsoleSink()];
  if (config.loki.url) sinks.push(new LokiSink(config.loki));
  return new Logger({ sinks, level: config.logLevel });
}

export function createGameServer(config = loadServerConfig()) {
  const deckFactory = new DeckFactory(new FisherYatesShuffler());
  const matchRule = new SameRankRule();

  /* ---- 監視（記録と数値）。connections と rooms は下で作るので、関数で遅延参照する ---- */
  const connections = new Set();
  const gate = new ConnectionGate({ maxConnections: config.maxConnections, maxPerAddress: config.maxConnectionsPerAddress });
  const logger = createLogger(config);
  const metrics = new ServerMetrics({
    gauges: () => ({ connections: connections.size, ...gate.stats(), ...rooms.stats() }),
    errorCount: () => logger.errorCount
  });

  const rooms = new RoomManager({
    codeGenerator: new RoomCodeGenerator(),
    maxRooms: config.maxRooms,
    emptyRoomTtlMs: config.emptyRoomTtlMs,
    lobbySeatGraceMs: config.lobbySeatGraceMs,
    createScheduler: () => new TimerScheduler(),
    onRoomOpened: room => {
      metrics.count(Counter.RoomsCreated);
      logger.info('room_created', { ...room.settings, rooms: rooms.size });
    },
    onRoomClosed: () => logger.info('room_closed', { rooms: rooms.size }),
    createMatch: (playerNames, settings) => {
      const match = new OnlineMatch({
        playerNames,
        difficultyId: settings.difficultyId,
        deckSize: settings.deckSize,
        deckFactory, deckOptions: DECK_OPTIONS, matchRule, timing: TIMING,
        scheduler: new TimerScheduler(),
        turnTimeoutMs: config.turnTimeoutMs,
        disconnectGraceMs: config.disconnectGraceMs
      });
      const startedAt = Date.now();
      metrics.count(Counter.MatchesStarted);
      logger.info('match_started', { ...settings, playerCount: playerNames.length });
      match.on(MatchEvent.Finished, () => {
        metrics.count(Counter.MatchesFinished);
        logger.info('match_finished', { ...settings, playerCount: playerNames.length, durationSec: Math.round((Date.now() - startedAt) / 1000) });
      });
      return match;
    }
  });

  const router = new HttpRouter({
    staticFiles: new StaticFileServer({ root: config.publicRoot, publicEntries: ['index.html', 'css', 'src'] }),
    roomStats: () => ({ rooms: rooms.size }),
    stats: () => metrics.snapshot(),
    statsToken: config.statsToken
  });
  const httpServer = http.createServer((req, res) => {
    router.handle(req, res).catch(err => {
      logger.error('http_error', err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  const originPolicy = new OriginPolicy({ allowedOrigins: config.allowedOrigins });
  const wss = new WebSocketServer({
    server: httpServer,
    path: SOCKET_PATH,
    maxPayload: LIMITS.maxMessageBytes,
    verifyClient: ({ origin, req }) => originPolicy.isAllowed(origin, req.headers.host)
  });
  const roomAccess = new RoomAccessLimiter({ createLimit: config.roomCreateLimit, joinMissLimit: config.joinMissLimit });
  const dispatcher = new MessageDispatcher({
    rooms, roomAccess, logger,
    onLimited: kind => {
      metrics.count(kind === 'create' ? Counter.RoomCreatesLimited : Counter.RoomJoinsLimited);
      // 総当たりの最中は大量に出るので、ふだんは記録せず回数（/api/stats）で見る
      logger.debug('room_access_limited', { kind });
    }
  });
  wss.on('connection', (socket, req) => {
    // 住所そのものは記録しない（件数と、読み取れたかどうかだけ）
    const address = resolveClientAddress(req, { trustProxyHops: config.trustProxyHops });
    const rejected = gate.admit(address);
    if (rejected) {
      metrics.count(Counter.ConnectionsRejected);
      logger.debug('ws_rejected', { reason: rejected });
      socket.send(encode(ServerMessage.Error, { code: ErrorCode.ServerBusy, message: '混み合っています。しばらくしてからお試しください' }));
      socket.close(1013);
      return;
    }
    const connection = new ClientConnection(socket, { rateLimit: config.rateLimit, address, logger });
    connections.add(connection);
    metrics.count(Counter.Connections);
    logger.info('ws_connected', {
      connections: connections.size,
      addressResolved: address !== null,
      forwardedForEntries: forwardedEntryCount(req)
    });
    connection.on('closed', () => {
      connections.delete(connection);
      gate.release(address);
      logger.info('ws_closed', { connections: connections.size });
    });
    dispatcher.attach(connection);
  });

  const heartbeat = setInterval(() => {
    connections.forEach(c => c.checkAlive());
    roomAccess.sweep();
  }, config.heartbeatMs);
  heartbeat.unref();

  return {
    httpServer,
    logger,
    listen: () => new Promise(resolve => httpServer.listen(config.port, config.host, () => {
      logger.info('server_started', { port: httpServer.address().port, lokiEnabled: Boolean(config.loki.url) });
      resolve();
    })),
    close: async () => {
      clearInterval(heartbeat);
      rooms.disposeAll();
      connections.forEach(c => c.close());
      wss.close();
      await new Promise(resolve => httpServer.close(() => resolve()));
      logger.info('server_stopped');
      await logger.close();
    }
  };
}

/* `node server/index.js` で直接起動されたときだけ待ち受ける（テストからは createGameServer を使う） */
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadServerConfig();
  const server = createGameServer(config);
  await server.listen();
  console.log(`浮遊トランプ神経衰弱サーバー: http://localhost:${config.port}`);
  const shutdown = async () => {
    console.log('終了します…');
    await server.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  // 最後の安全網：思わぬ例外で落ちるときも、原因を記録に残してから終わる（Render が起動し直す）
  const crash = async err => {
    server.logger.error('uncaught_exception', err instanceof Error ? err : { message: String(err) });
    await server.logger.close();
    process.exit(1);
  };
  process.on('uncaughtException', crash);
  process.on('unhandledRejection', crash);
}

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
import { RoomManager } from './rooms/RoomManager.js';
import { RoomCodeGenerator } from './rooms/RoomCodeGenerator.js';
import { OnlineMatch } from './match/OnlineMatch.js';
import { TimerScheduler } from './match/TimerScheduler.js';

import { SOCKET_PATH, LIMITS } from '../src/net/Protocol.js';
import { DeckFactory } from '../src/domain/DeckFactory.js';
import { FisherYatesShuffler } from '../src/domain/Shuffler.js';
import { SameRankRule } from '../src/domain/MatchRule.js';
import { DECK_OPTIONS, TIMING } from '../src/config/GameConfig.js';

export function createGameServer(config = loadServerConfig()) {
  const deckFactory = new DeckFactory(new FisherYatesShuffler());
  const matchRule = new SameRankRule();

  const rooms = new RoomManager({
    codeGenerator: new RoomCodeGenerator(),
    maxRooms: config.maxRooms,
    emptyRoomTtlMs: config.emptyRoomTtlMs,
    createMatch: (playerNames, settings) => new OnlineMatch({
      playerNames,
      difficultyId: settings.difficultyId,
      deckSize: settings.deckSize,
      deckFactory, deckOptions: DECK_OPTIONS, matchRule, timing: TIMING,
      scheduler: new TimerScheduler(),
      turnTimeoutMs: config.turnTimeoutMs,
      disconnectGraceMs: config.disconnectGraceMs
    })
  });

  const router = new HttpRouter({
    staticFiles: new StaticFileServer({ root: config.publicRoot, publicEntries: ['index.html', 'css', 'src'] }),
    roomStats: () => ({ rooms: rooms.size })
  });
  const httpServer = http.createServer((req, res) => {
    router.handle(req, res).catch(err => {
      console.error('[http]', err);
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
  const dispatcher = new MessageDispatcher({ rooms });
  const connections = new Set();
  wss.on('connection', socket => {
    const connection = new ClientConnection(socket, { rateLimit: config.rateLimit });
    connections.add(connection);
    connection.on('closed', () => connections.delete(connection));
    dispatcher.attach(connection);
  });

  const heartbeat = setInterval(() => connections.forEach(c => c.checkAlive()), config.heartbeatMs);
  heartbeat.unref();

  return {
    httpServer,
    listen: () => new Promise(resolve => httpServer.listen(config.port, config.host, resolve)),
    close: () => new Promise(resolve => {
      clearInterval(heartbeat);
      rooms.disposeAll();
      connections.forEach(c => c.close());
      wss.close();
      httpServer.close(() => resolve());
    })
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
}

import { ClientMessage, ServerMessage, ErrorCode } from '../../src/net/Protocol.js';
import { ConnectionEvent } from './ClientConnection.js';
import { RoomError } from '../rooms/RoomError.js';

/**
 * 接続から届いたメッセージを、部屋の一覧（RoomManager）か、入っている部屋（Room）へ振り分ける。
 * 部屋の操作でエラーが起きたら、その人にだけエラーを返す。
 * 部屋を作る・部屋番号で入るは、roomAccess（RoomAccessLimiter）で回数を制限する。
 */
export class MessageDispatcher {
  /**
   * @param {(kind: 'create'|'join') => void} [p.onLimited]  回数の上限で断ったときに呼ぶ（記録用）
   */
  constructor({ rooms, roomAccess, now = () => Date.now(), logger = console, onLimited = () => {} }) {
    this.rooms = rooms;
    this.roomAccess = roomAccess;
    this.now = now;
    this.logger = logger;
    this.onLimited = onLimited;
  }

  attach(connection) {
    connection.on(ConnectionEvent.Message, ({ type, payload }) => this.#dispatch(connection, type, payload));
    connection.on(ConnectionEvent.Closed, () => this.rooms.disconnect(connection));
  }

  #dispatch(connection, type, payload) {
    try {
      switch (type) {
        case ClientMessage.Ping:
          return connection.send(ServerMessage.Pong, { t: payload.t, serverNow: this.now() });
        case ClientMessage.CreateRoom:
          if (!this.roomAccess.tryCreate(connection)) {
            this.onLimited('create');
            throw new RoomError(ErrorCode.RateLimited, '部屋を作る回数が多すぎます。しばらくしてからお試しください');
          }
          return this.rooms.create(connection, payload);
        case ClientMessage.JoinRoom:
          return this.#join(connection, payload);
        case ClientMessage.LeaveRoom:
          return this.rooms.leave(connection);
        default:
          if (!connection.room) throw new RoomError(ErrorCode.NotInRoom, '部屋に入っていません');
          return connection.room.handle(connection, type, payload);
      }
    } catch (err) {
      if (err instanceof RoomError) return connection.sendError(err.code, err.message);
      this.logger.error('dispatch_error', err);
      return connection.sendError(ErrorCode.InvalidMessage, 'サーバーでエラーが起きました');
    }
  }

  /** 部屋番号の総当たりを防ぐため、外した回数が多い人はしばらく受け付けない */
  #join(connection, payload) {
    if (!this.roomAccess.canTryJoin(connection)) {
      this.onLimited('join');
      throw new RoomError(ErrorCode.RateLimited, '部屋番号の入力が多すぎます。しばらくしてからお試しください');
    }
    try {
      return this.rooms.join(connection, payload);
    } catch (err) {
      if (err instanceof RoomError && err.code === ErrorCode.RoomNotFound) this.roomAccess.recordJoinMiss(connection);
      throw err;
    }
  }
}

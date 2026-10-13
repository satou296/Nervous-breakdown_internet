import { ClientMessage, ServerMessage, ErrorCode } from '../../src/net/Protocol.js';
import { ConnectionEvent } from './ClientConnection.js';
import { RoomError } from '../rooms/RoomError.js';

/**
 * 接続から届いたメッセージを、部屋の一覧（RoomManager）か、入っている部屋（Room）へ振り分ける。
 * 部屋の操作でエラーが起きたら、その人にだけエラーを返す。
 */
export class MessageDispatcher {
  constructor({ rooms, now = () => Date.now(), logger = console }) {
    this.rooms = rooms;
    this.now = now;
    this.logger = logger;
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
          return this.rooms.create(connection, payload);
        case ClientMessage.JoinRoom:
          return this.rooms.join(connection, payload);
        case ClientMessage.LeaveRoom:
          return this.rooms.leave(connection);
        default:
          if (!connection.room) throw new RoomError(ErrorCode.NotInRoom, '部屋に入っていません');
          return connection.room.handle(connection, type, payload);
      }
    } catch (err) {
      if (err instanceof RoomError) return connection.sendError(err.code, err.message);
      this.logger.error('[dispatch]', err);
      return connection.sendError(ErrorCode.InvalidMessage, 'サーバーでエラーが起きました');
    }
  }
}

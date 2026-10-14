import { ErrorCode } from '../../src/net/Protocol.js';
import { Room, RoomState } from './Room.js';
import { RoomError } from './RoomError.js';

/**
 * 部屋の一覧を管理する。作る・探す・誰もいなくなった部屋を片付ける。
 * 部屋の情報はこのサーバーのメモリにだけあるので、サーバーは1台で動かす前提。
 */
export class RoomManager {
  #rooms = new Map();
  #cleanupTimers = new Map();

  /**
   * @param {(room: Room) => void} [p.onRoomOpened]  部屋ができたときに呼ぶ（記録用）
   * @param {(room: Room) => void} [p.onRoomClosed]  誰もいなくなった部屋を消したときに呼ぶ（記録用）
   */
  constructor({ codeGenerator, createMatch, maxRooms, emptyRoomTtlMs, onRoomOpened = () => {}, onRoomClosed = () => {} }) {
    this.codeGenerator = codeGenerator;
    this.createMatch = createMatch;
    this.maxRooms = maxRooms;
    this.emptyRoomTtlMs = emptyRoomTtlMs;
    this.onRoomOpened = onRoomOpened;
    this.onRoomClosed = onRoomClosed;
  }

  get size() { return this.#rooms.size; }

  /** 監視用：いまの部屋数・対戦中の部屋数・つながっている人数 */
  stats() {
    const rooms = [...this.#rooms.values()];
    return {
      rooms: rooms.length,
      roomsPlaying: rooms.filter(r => r.state === RoomState.Playing).length,
      players: rooms.reduce((sum, r) => sum + r.connectedCount, 0)
    };
  }

  create(connection, { name, difficultyId, deckSize }) {
    if (this.#rooms.size >= this.maxRooms) throw new RoomError(ErrorCode.ServerBusy, '混み合っています。しばらくしてからお試しください');
    this.leave(connection);
    const code = this.codeGenerator.next(c => this.#rooms.has(c));
    const room = new Room({
      code,
      settings: { difficultyId, deckSize },
      createMatch: this.createMatch,
      onVacancyChange: r => this.#watchVacancy(r)
    });
    this.#rooms.set(code, room);
    room.join(connection, { name });
    this.onRoomOpened(room);
    return room;
  }

  join(connection, { code, name, token }) {
    const room = this.#rooms.get(code);
    if (!room) throw new RoomError(ErrorCode.RoomNotFound, '部屋が見つかりません。URLを確認してください');
    if (connection.room && connection.room !== room) this.leave(connection);
    room.join(connection, { name, token });
    return room;
  }

  leave(connection) {
    connection.room?.leave(connection);
  }

  disconnect(connection) {
    connection.room?.disconnect(connection);
  }

  disposeAll() {
    this.#cleanupTimers.forEach(clearTimeout);
    this.#rooms.forEach(r => r.dispose());
    this.#rooms.clear();
  }

  /** 全員いなくなったら一定時間後に部屋を消す。誰か戻れば取りやめる */
  #watchVacancy(room) {
    const pending = this.#cleanupTimers.get(room.code);
    if (!room.isVacant) {
      if (pending) clearTimeout(pending);
      this.#cleanupTimers.delete(room.code);
      return;
    }
    if (pending) return;
    const timer = setTimeout(() => {
      this.#cleanupTimers.delete(room.code);
      if (!room.isVacant) return;
      room.dispose();
      this.#rooms.delete(room.code);
      this.onRoomClosed(room);
    }, this.emptyRoomTtlMs);
    timer.unref?.();
    this.#cleanupTimers.set(room.code, timer);
  }
}

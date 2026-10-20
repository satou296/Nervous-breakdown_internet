import { ClientMessage, ServerMessage, ErrorCode, LIMITS } from '../../src/net/Protocol.js';
import { MatchEvent, MatchError } from '../match/OnlineMatch.js';
import { RoomError } from './RoomError.js';
import { Seat } from './Seat.js';

export const RoomState = Object.freeze({ Lobby: 'lobby', Playing: 'playing' });

/**
 * 1つの部屋。席の出入り・部屋を作った人（ホスト）の管理・試合の開始・メッセージの中継を担う。
 * ルールの判定は OnlineMatch に任せ、部屋は「誰に何を送るか」だけを決める。
 */
export class Room {
  #seats = [];
  #hostIndex = 0;
  #state = RoomState.Lobby;
  #match = null;

  /**
   * @param {object} p
   * @param {string} p.code
   * @param {{ difficultyId: string, deckSize: number }} p.settings
   * @param {(names: string[], settings) => OnlineMatch} p.createMatch
   * @param {(room: Room) => void} p.onVacancyChange  全員いなくなった／誰か戻ったときに呼ぶ
   */
  constructor({ code, settings, createMatch, onVacancyChange = () => {} }) {
    this.code = code;
    this.settings = Object.freeze({ ...settings });
    this.createMatch = createMatch;
    this.onVacancyChange = onVacancyChange;
  }

  get state() { return this.#state; }
  get isVacant() { return this.#seats.every(s => !s.connected); }
  /** 誰もいなくて、戻れる人（token を持つ席）もいない。待つ意味がないのですぐ片付けてよい */
  get isAbandoned() { return this.#seats.every(s => !s.connected && !s.token); }
  get connectedCount() { return this.#seats.filter(s => s.connected).length; }

  /* ---------------- 出入り ---------------- */

  join(connection, { name, token = null }) {
    // すでにこの部屋に座っている接続は、席を増やさず今の席を知らせ直すだけ（1接続で席を埋められないように）
    const current = this.#seatOf(connection);
    if (current) {
      current.send(ServerMessage.RoomJoined, { code: this.code, you: { index: current.index, token: current.token }, room: this.info() });
      return;
    }
    const returning = token ? this.#seats.find(s => s.token === token) : null;
    if (returning) return this.#rejoin(returning, connection);
    if (this.#state === RoomState.Playing) throw new RoomError(ErrorCode.MatchInProgress, 'この部屋は対戦中です');
    if (this.#seats.length >= LIMITS.maxPlayers) throw new RoomError(ErrorCode.RoomFull, 'この部屋は満員です');

    const seat = new Seat({ index: this.#seats.length, name, connection });
    this.#seats.push(seat);
    connection.room = this;
    seat.send(ServerMessage.RoomJoined, { code: this.code, you: { index: seat.index, token: seat.token }, room: this.info() });
    this.#broadcastRoom();
    this.onVacancyChange(this);
  }

  /** 自分から抜けた。待合室なら席を空け、対戦中なら切断扱い（以降の手番は自動で飛ばす） */
  leave(connection) {
    const seat = this.#seatOf(connection);
    if (!seat) return;
    connection.room = null;
    if (this.#state === RoomState.Lobby) {
      this.#removeSeat(seat);
    } else {
      seat.detach();
      seat.token = null; // 自分から抜けた人は戻れない
      this.#match?.setConnected(seat.index, false);
      this.#broadcastStatus(seat);
    }
    this.#broadcastRoom();
    this.onVacancyChange(this);
  }

  /** 接続が切れた。席は残し、token を持っていれば戻れる */
  disconnect(connection) {
    const seat = this.#seatOf(connection);
    if (!seat) return;
    seat.detach();
    this.#match?.setConnected(seat.index, false);
    this.#broadcastStatus(seat);
    this.#broadcastRoom();
    this.onVacancyChange(this);
  }

  /* ---------------- 部屋の中の操作 ---------------- */

  handle(connection, type, payload) {
    const seat = this.#seatOf(connection);
    if (!seat) throw new RoomError(ErrorCode.NotInRoom, '部屋に入っていません');
    switch (type) {
      case ClientMessage.StartMatch: return this.#startMatch(seat);
      case ClientMessage.SelectCard: return this.#select(seat, payload.cardId);
      case ClientMessage.Presence: return this.#relay(seat, ServerMessage.Presence, { playerIndex: seat.index, ...payload });
      case ClientMessage.Knock:
        // 弾けるのは、いま腕を伸ばせる人（手番の人）だけ
        if (this.#match?.isCurrent(seat.index)) this.#relay(seat, ServerMessage.Knock, { playerIndex: seat.index, ...payload });
        return undefined;
      default:
        throw new RoomError(ErrorCode.InvalidMessage, '部屋では使えない操作です');
    }
  }

  info() {
    return {
      code: this.code,
      hostIndex: this.#hostIndex,
      state: this.#state,
      settings: this.settings,
      players: this.#seats.map(s => s.toPublic())
    };
  }

  dispose() {
    this.#match?.dispose();
    this.#match = null;
    this.#seats.forEach(s => { if (s.connection) s.connection.room = null; });
  }

  /* ---------------- 内部 ---------------- */

  #rejoin(seat, connection) {
    seat.attach(connection);
    connection.room = this;
    seat.send(ServerMessage.RoomJoined, { code: this.code, you: { index: seat.index, token: seat.token }, room: this.info() });
    if (this.#match) {
      this.#match.setConnected(seat.index, true);
      seat.send(ServerMessage.MatchStarted, this.#match.startInfoFor(seat.index));
    }
    this.#broadcastStatus(seat);
    this.#broadcastRoom();
    this.onVacancyChange(this);
  }

  #startMatch(seat) {
    if (seat.index !== this.#hostIndex) throw new RoomError(ErrorCode.NotHost, '開始できるのは部屋を作った人だけです');
    if (this.#state === RoomState.Playing) throw new RoomError(ErrorCode.MatchInProgress, 'すでに対戦中です');
    this.#seats.filter(s => !s.connected).forEach(s => this.#removeSeat(s));
    if (this.#seats.length < LIMITS.minPlayers) throw new RoomError(ErrorCode.NotEnoughPlayers, `${LIMITS.minPlayers}人以上そろうと始められます`);

    this.#match = this.createMatch(this.#seats.map(s => s.name), this.settings);
    this.#match.on(MatchEvent.Outbound, ({ type, payload }) => this.#broadcast(type, payload));
    this.#match.on(MatchEvent.Finished, () => this.#endMatch());
    this.#state = RoomState.Playing;
    this.#match.start();
    for (const s of this.#seats) s.send(ServerMessage.MatchStarted, this.#match.startInfoFor(s.index));
    this.#broadcastRoom();
  }

  #select(seat, cardId) {
    if (!this.#match) throw new RoomError(ErrorCode.InvalidMessage, '対戦が始まっていません');
    try {
      this.#match.select(seat.index, cardId);
    } catch (err) {
      if (err instanceof MatchError) throw new RoomError(err.code, err.message);
      throw err;
    }
  }

  /** 試合が終わったら待合室に戻る（ホストがもう一度始められる） */
  #endMatch() {
    this.#match?.dispose();
    this.#match = null;
    this.#state = RoomState.Lobby;
    this.#seats.filter(s => !s.connected).forEach(s => this.#removeSeat(s));
    this.#broadcastRoom();
  }

  #removeSeat(seat) {
    const removed = seat.index;
    this.#seats = this.#seats.filter(s => s !== seat);
    this.#seats.forEach((s, i) => { s.index = i; });
    // ホストが抜けたら先頭の人がホストに。前の席が抜けたらホストの番号を詰める
    if (removed === this.#hostIndex) this.#hostIndex = 0;
    else if (removed < this.#hostIndex) this.#hostIndex -= 1;
    // 番号が変わった人に、新しい番号を知らせ直す
    this.#seats.forEach(s => s.send(ServerMessage.RoomJoined, { code: this.code, you: { index: s.index, token: s.token }, room: this.info() }));
  }

  #seatOf(connection) {
    return this.#seats.find(s => s.connection === connection) ?? null;
  }

  #broadcast(type, payload) {
    for (const s of this.#seats) s.send(type, payload);
  }

  #relay(from, type, payload) {
    for (const s of this.#seats) if (s !== from) s.send(type, payload);
  }

  #broadcastRoom() {
    this.#broadcast(ServerMessage.RoomUpdated, { room: this.info() });
  }

  #broadcastStatus(seat) {
    this.#broadcast(ServerMessage.PlayerStatus, { index: seat.index, name: seat.name, connected: seat.connected });
  }
}

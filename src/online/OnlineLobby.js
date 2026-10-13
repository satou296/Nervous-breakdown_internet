import { EventEmitter } from '../core/EventEmitter.js';
import { ClientMessage, ServerMessage, LIMITS } from '../net/Protocol.js';
import { NetworkEvent } from './NetworkClient.js';
import { LobbyScreenEvent } from '../ui/LobbyScreen.js';
import { getDifficulty } from '../config/Difficulties.js';
import { TEXT } from '../config/strings.js';

export const LobbyEvent = Object.freeze({
  MatchStarted: 'matchStarted',   // payload: サーバーの match_started の中身
  Exited: 'exited',               // payload: { message? } 部屋から出た（スタート画面へ）
  ConnectionLost: 'connectionLost',
  ConnectionRestored: 'connectionRestored'
});

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 8000];

/**
 * オンライン対戦の「部屋」まわりの進行役。
 * 名前入力 → 部屋を作る／参加する → 待合室 → 試合開始（MatchStarted）を、
 * 画面（LobbyScreen）と通信（NetworkClient）の間でつなぐ。
 * 接続が切れたら、合言葉（token）を使って自動で同じ席に戻る。
 */
export class OnlineLobby extends EventEmitter {
  #purpose = null;          // 'create' | 'join'
  #settings = null;
  #code = null;
  #youIndex = null;
  #room = null;
  #inRoom = false;
  #reconnecting = false;

  constructor({ network, screen, identity, link }) {
    super();
    this.network = network;
    this.screen = screen;
    this.identity = identity;
    this.link = link;
    this.#wire();
  }

  get inRoom() { return this.#inRoom; }

  /** 部屋を作る（メニューで選んだ難易度・枚数を使う） */
  openCreate(settings) {
    this.#purpose = 'create';
    this.#settings = settings;
    this.screen.showNameForm({ purpose: 'create', name: this.identity.name });
  }

  /** 招待URLの部屋に参加する */
  openJoin(code) {
    this.#purpose = 'join';
    this.#code = code;
    this.screen.showNameForm({ purpose: 'join', name: this.identity.name, code });
  }

  /** 試合が終わったあと、同じ部屋の待合室に戻る */
  showRoom() {
    if (this.#room) this.#renderRoom();
  }

  /** 部屋から出てスタート画面へ */
  leave() {
    if (this.#inRoom) this.network.send(ClientMessage.LeaveRoom);
    if (this.#code) this.identity.forgetToken(this.#code);
    this.#reset();
    this.network.disconnect();
    this.link.showHome();
    this.screen.hide();
  }

  /* ---------------- 配線 ---------------- */

  #wire() {
    this.screen.on(LobbyScreenEvent.Submit, ({ name }) => this.#submit(name));
    this.screen.on(LobbyScreenEvent.Start, () => this.network.send(ClientMessage.StartMatch));
    this.screen.on(LobbyScreenEvent.Leave, () => this.#exit());
    this.screen.on(LobbyScreenEvent.Back, () => this.#exit());

    this.network.on(ServerMessage.RoomJoined, p => this.#onRoomJoined(p));
    this.network.on(ServerMessage.RoomUpdated, ({ room }) => {
      this.#room = room;
      if (this.screen.isOpen && this.#inRoom) this.#renderRoom();
    });
    this.network.on(ServerMessage.MatchStarted, p => {
      this.screen.hide();
      this.emit(LobbyEvent.MatchStarted, p);
    });
    this.network.on(ServerMessage.Error, ({ message }) => {
      if (this.screen.isOpen) this.screen.showError(message);
    });
    this.network.on(NetworkEvent.Closed, () => {
      if (this.#inRoom) this.#reconnect();
    });
  }

  async #submit(name) {
    this.identity.name = name;
    try {
      await this.network.connect();
    } catch {
      this.screen.showError(TEXT.lobby.connectFailed);
      return;
    }
    if (this.#purpose === 'create') {
      this.network.send(ClientMessage.CreateRoom, { name, ...this.#settings });
    } else {
      this.network.send(ClientMessage.JoinRoom, { code: this.#code, name, token: this.identity.tokenFor(this.#code) });
    }
  }

  #onRoomJoined({ code, you, room }) {
    const firstJoin = !this.#inRoom;
    this.#code = code;
    this.#youIndex = you.index;
    this.#room = room;
    this.#inRoom = true;
    this.identity.rememberToken(code, you.token);
    this.link.showRoom(code);
    // 対戦中に戻ってきたときは、このあと match_started が届くので待合室は出さない。
    // 結果画面を見ている間に番号が振り直されたときも、待合室を勝手に出さない
    if ((firstJoin && room.state !== 'playing') || this.screen.isOpen) this.#renderRoom();
  }

  #renderRoom() {
    this.screen.showRoom({
      room: { ...this.#room, minPlayers: LIMITS.minPlayers },
      youIndex: this.#youIndex,
      inviteUrl: this.link.inviteUrl(this.#room.code),
      difficultyLabel: getDifficulty(this.#room.settings.difficultyId).label
    });
  }

  /** 切れたら、少しずつ間隔をあけて同じ席に戻ろうとする */
  async #reconnect() {
    if (this.#reconnecting) return;
    this.#reconnecting = true;
    this.emit(LobbyEvent.ConnectionLost);
    for (const delay of RECONNECT_DELAYS_MS) {
      await new Promise(r => setTimeout(r, delay));
      if (!this.#inRoom) break;
      try {
        await this.network.connect();
        this.network.send(ClientMessage.JoinRoom, {
          code: this.#code, name: this.identity.name || 'player', token: this.identity.tokenFor(this.#code)
        });
        this.#reconnecting = false;
        this.emit(LobbyEvent.ConnectionRestored);
        return;
      } catch {
        // 次の間隔で再挑戦
      }
    }
    this.#reconnecting = false;
    if (this.#inRoom) {
      this.leave();
      this.emit(LobbyEvent.Exited, { message: TEXT.online.connectionGaveUp });
    }
  }

  #exit() {
    this.leave();
    this.emit(LobbyEvent.Exited, {});
  }

  #reset() {
    this.#inRoom = false;
    this.#room = null;
    this.#youIndex = null;
    this.#code = null;
  }
}

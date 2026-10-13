import { EventEmitter } from '../core/EventEmitter.js';
import { encode, decode, ClientMessage, ServerMessage, SOCKET_PATH } from '../net/Protocol.js';

export const NetworkEvent = Object.freeze({
  Open: 'open',
  Closed: 'closed',     // 接続が切れた（自分で切ったときは来ない）
  Message: 'message'    // { type, payload }（種類ごとのイベント名でも届く）
});

/**
 * サーバーとの WebSocket 接続。
 * 届いたメッセージは「種類の名前」のイベントとして通知する（例：on('card_revealed', ...)）。
 * 時計合わせ用の ping も定期的に送る。
 */
export class NetworkClient extends EventEmitter {
  #socket = null;
  #pingTimer = null;
  #closing = false;

  constructor({ url = NetworkClient.defaultUrl(), pingIntervalMs = 4000, WebSocketImpl = globalThis.WebSocket } = {}) {
    super();
    this.url = url;
    this.pingIntervalMs = pingIntervalMs;
    this.WebSocketImpl = WebSocketImpl;
  }

  /** このページを配信しているサーバーの /ws */
  static defaultUrl(loc = globalThis.location) {
    const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${loc.host}${SOCKET_PATH}`;
  }

  get isOpen() { return this.#socket?.readyState === 1; }

  /** @returns {Promise<void>} つながったら解決、失敗したら拒否 */
  connect() {
    if (this.isOpen) return Promise.resolve();
    this.#closing = false;
    return new Promise((resolve, reject) => {
      const socket = new this.WebSocketImpl(this.url);
      this.#socket = socket;
      socket.onopen = () => {
        this.#startPing();
        this.emit(NetworkEvent.Open);
        resolve();
      };
      socket.onerror = () => reject(new Error('サーバーにつながりませんでした'));
      socket.onclose = () => {
        this.#stopPing();
        if (this.#socket === socket) this.#socket = null;
        if (!this.#closing) this.emit(NetworkEvent.Closed);
      };
      socket.onmessage = e => this.#onMessage(e.data);
    });
  }

  send(type, payload = {}) {
    if (this.isOpen) this.#socket.send(encode(type, payload));
  }

  disconnect() {
    this.#closing = true;
    this.#stopPing();
    this.#socket?.close();
    this.#socket = null;
  }

  #onMessage(text) {
    const message = decode(text);
    if (!message) return;
    this.emit(NetworkEvent.Message, message);
    this.emit(message.type, message.payload);
  }

  #startPing() {
    this.#stopPing();
    const ping = () => this.send(ClientMessage.Ping, { t: Date.now() });
    ping();
    this.#pingTimer = setInterval(ping, this.pingIntervalMs);
  }

  #stopPing() {
    clearInterval(this.#pingTimer);
    this.#pingTimer = null;
  }
}

export { ServerMessage };

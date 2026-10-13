import { randomUUID } from 'node:crypto';
import { EventEmitter } from '../../src/core/EventEmitter.js';
import { encode, decode, ServerMessage, ErrorCode, LIMITS } from '../../src/net/Protocol.js';
import { validateClientMessage, ValidationError } from './MessageValidator.js';
import { RateLimiter } from './RateLimiter.js';

export const ConnectionEvent = Object.freeze({
  Message: 'message', // { type, payload }（検証済み）
  Closed: 'closed'
});

/**
 * 1人分の WebSocket 接続。
 * 受け取ったメッセージの解読・検証・回数制限をして、正しいものだけを Message として通知する。
 * 送るときは send(type, payload)。
 */
export class ClientConnection extends EventEmitter {
  #socket;
  #limiter;
  #alive = true;

  /** 入っている部屋（Room が設定する） */
  room = null;

  constructor(socket, { rateLimit }) {
    super();
    this.id = randomUUID();
    this.#socket = socket;
    this.#limiter = new RateLimiter(rateLimit);
    socket.on('message', (data, isBinary) => this.#onMessage(data, isBinary));
    socket.on('pong', () => { this.#alive = true; });
    socket.on('close', () => this.emit(ConnectionEvent.Closed));
    socket.on('error', () => socket.terminate());
  }

  get isOpen() { return this.#socket.readyState === 1; }

  send(type, payload) {
    if (this.isOpen) this.#socket.send(encode(type, payload));
  }

  sendError(code, message) {
    this.send(ServerMessage.Error, { code, message });
  }

  /** 応答のない接続を切る（heartbeat ごとに呼ぶ） */
  checkAlive() {
    if (!this.#alive) {
      this.#socket.terminate();
      return;
    }
    this.#alive = false;
    this.#socket.ping();
  }

  close() {
    this.#socket.close();
  }

  #onMessage(data, isBinary) {
    if (isBinary || data.length > LIMITS.maxMessageBytes) return this.sendError(ErrorCode.InvalidMessage, '受け取れない形式です');
    if (!this.#limiter.tryTake()) return this.sendError(ErrorCode.RateLimited, '操作が多すぎます');
    const message = decode(data.toString());
    if (!message) return this.sendError(ErrorCode.InvalidMessage, '受け取れない形式です');
    try {
      const payload = validateClientMessage(message.type, message.payload);
      this.emit(ConnectionEvent.Message, { type: message.type, payload });
    } catch (err) {
      if (err instanceof ValidationError) this.sendError(ErrorCode.InvalidMessage, err.message);
      else throw err;
    }
  }
}

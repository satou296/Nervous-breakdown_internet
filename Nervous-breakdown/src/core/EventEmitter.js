/**
 * 最小限の Observer 実装。発行側は購読側を知らずに通知できる。
 */
export class EventEmitter {
  #handlers = new Map();

  /** @returns {() => void} 購読解除関数 */
  on(type, handler) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, new Set());
    this.#handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this.#handlers.get(type)?.delete(handler);
  }

  emit(type, payload) {
    const set = this.#handlers.get(type);
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  removeAllListeners() {
    this.#handlers.clear();
  }
}

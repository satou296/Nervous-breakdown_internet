/**
 * requestAnimationFrame によるフレームループ。
 * 登録された Updatable（update(dt, elapsed) を持つオブジェクト）を登録順に呼ぶ。
 */
export class GameLoop {
  #items = [];
  #last = 0;
  #elapsed = 0;
  #running = false;
  #maxDelta;

  /**
   * @param {number} maxDelta 1フレームで進める最大秒数。
   *   低フレームレートの端末でもゲーム内時計が実時間から遅れないよう、少し大きめにしている。
   *   （タブ切り替えなどの長い中断は App が自動ポーズで扱う）
   */
  constructor({ maxDelta = 0.25 } = {}) {
    this.#maxDelta = maxDelta;
  }

  add(updatable) {
    if (typeof updatable?.update !== 'function') {
      throw new TypeError('GameLoop.add には update(dt, elapsed) を持つオブジェクトを渡してください');
    }
    this.#items.push(updatable);
    return this;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#last = performance.now();
    requestAnimationFrame(this.#tick);
  }

  stop() {
    this.#running = false;
  }

  #tick = (now) => {
    if (!this.#running) return;
    const dt = Math.min((now - this.#last) / 1000, this.#maxDelta);
    this.#last = now;
    this.#elapsed += dt;
    for (const item of this.#items) item.update(dt, this.#elapsed);
    requestAnimationFrame(this.#tick);
  };
}

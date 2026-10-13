/**
 * 一時停止できるゲーム内時計。
 * 実時間ではなく「進めた分だけ」進むので、ポーズ中はタイマーも予約処理も止まる。
 */
export class PausableClock {
  #elapsedMs = 0;
  #paused = false;

  get nowMs() { return this.#elapsedMs; }
  get elapsedSec() { return this.#elapsedMs / 1000; }
  get isPaused() { return this.#paused; }

  /** 時計を指定の時刻に合わせる（オンライン対戦でサーバーの時刻にそろえるため） */
  setNowMs(ms) { this.#elapsedMs = ms; }

  pause() { this.#paused = true; }
  resume() { this.#paused = false; }

  /**
   * 時計を dtSec 秒進める。
   * @returns {number} 実際に進んだ秒数（ポーズ中は 0）
   */
  advance(dtSec) {
    if (this.#paused) return 0;
    this.#elapsedMs += dtSec * 1000;
    return dtSec;
  }
}

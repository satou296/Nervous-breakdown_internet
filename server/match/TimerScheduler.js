/**
 * サーバー用の遅延実行（実時間）。after() は取り消し用の関数を返す。
 * cancelAll() で、その試合の予約をまとめて取り消せる。
 * テストでは同じ形の偽物（すぐ実行するもの）に差し替えられる。
 */
export class TimerScheduler {
  #timers = new Set();

  after(ms, task) {
    const id = setTimeout(() => {
      this.#timers.delete(id);
      task();
    }, ms);
    this.#timers.add(id);
    return () => {
      clearTimeout(id);
      this.#timers.delete(id);
    };
  }

  cancelAll() {
    this.#timers.forEach(clearTimeout);
    this.#timers.clear();
  }
}

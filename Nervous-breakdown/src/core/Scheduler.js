/**
 * 時計に従って遅延処理を実行するスケジューラ。Updatable。
 * setTimeout ではなく渡された時計（PausableClock など）の時刻で判定するので、
 * 時計が止まっている間は予約した処理も実行されない。
 */
export class Scheduler {
  #tasks = [];
  #generation = 0;

  /** @param {{ nowMs: number }} clock */
  constructor(clock) {
    this.clock = clock;
  }

  after(ms, task) {
    this.#tasks.push({ due: this.clock.nowMs + ms, task, generation: this.#generation });
  }

  update() {
    const now = this.clock.nowMs;
    const ready = this.#tasks.filter(t => t.due <= now).sort((a, b) => a.due - b.due);
    if (!ready.length) return;
    this.#tasks = this.#tasks.filter(t => t.due > now);
    for (const t of ready) {
      if (t.generation === this.#generation) t.task(); // 実行中に cancelAll されたら残りは捨てる
    }
  }

  cancelAll() {
    this.#generation++;
    this.#tasks = [];
  }

  get pendingCount() { return this.#tasks.length; }
}

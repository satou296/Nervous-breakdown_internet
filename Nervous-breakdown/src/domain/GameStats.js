/**
 * 手数と経過時間の記録。時計は注入できる。
 */
export class GameStats {
  #turns = 0;
  #startedAt = null;
  #endedAt = null;

  constructor(clock = () => performance.now()) {
    this.clock = clock;
  }

  get turns() { return this.#turns; }

  get elapsedMs() {
    if (this.#startedAt === null) return 0;
    return (this.#endedAt ?? this.clock()) - this.#startedAt;
  }

  markStarted() {
    if (this.#startedAt === null) this.#startedAt = this.clock();
  }

  countTurn() {
    this.#turns++;
  }

  markEnded() {
    if (this.#endedAt === null) this.#endedAt = this.clock();
  }
}

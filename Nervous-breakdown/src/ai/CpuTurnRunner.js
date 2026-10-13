/**
 * CPU の1手番を「考える → 狙う → めくる」の時間進行で実行する。
 * 何を選ぶかは strategy に、狙いの演出は aim コールバックに任せる。
 */
export class CpuTurnRunner {
  constructor({ strategy, scheduler, timing, aim, select }) {
    this.strategy = strategy;
    this.scheduler = scheduler;
    this.timing = timing;
    this.aim = aim;       // (card, done) => void
    this.select = select; // (card) => void
  }

  play(game) {
    const { cpuThinkMs, cpuBetweenPicksMs } = this.timing;
    this.scheduler.after(cpuThinkMs, () => {
      const first = this.strategy.chooseFirst(game.cards);
      if (!first) return;
      this.aim(first, () => {
        this.select(first);
        this.scheduler.after(cpuBetweenPicksMs, () => {
          const second = this.strategy.chooseSecond(first, game.cards);
          if (second) this.aim(second, () => this.select(second));
        });
      });
    });
  }
}

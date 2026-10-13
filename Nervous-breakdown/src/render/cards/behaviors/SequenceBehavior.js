/**
 * 手順（Step）を順番に実行する Behavior。最後の手順が終わったらその姿勢で静止する。
 * 「拡大して見せる → 少し待つ → 下へ寄せる」のような演出を、手順の組み合わせで表す。
 */
export class SequenceBehavior {
  pickable = false;
  #index = 0;

  constructor(steps) {
    this.steps = steps;
  }

  get isFinished() { return this.#index >= this.steps.length; }

  enter(view) {
    this.#index = 0;
    this.steps[0]?.start(view.object);
  }

  update(view, dt) {
    let remaining = dt;
    while (!this.isFinished) {
      const done = this.steps[this.#index].step(view.object, remaining);
      if (!done) return;
      this.#index++;
      this.steps[this.#index]?.start(view.object);
      remaining = 0;
    }
  }
}

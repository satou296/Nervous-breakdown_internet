/**
 * W / S（タッチ端末では画面のボタン）の長押しを腕の伸び縮みに変換し、メーター表示を更新する。Updatable。
 * 操作できないとき（達人モード以外・相手の番など）は腕を自然に戻す。
 */
export class ReachController {
  /** @param {{ reachAxis: number }[]} p.inputs 伸ばす +1／縮める -1 を返す入力（キーボード・ボタン） */
  constructor({ inputs, reach, meter, isEnabled }) {
    this.inputs = inputs;
    this.reach = reach;
    this.meter = meter;
    this.isEnabled = isEnabled;
  }

  update(dt) {
    if (this.isEnabled()) this.reach.adjust(this.#axis(), dt);
    else this.reach.relax(dt);
    this.meter.setLevel(this.reach.fraction);
  }

  #axis() {
    const sum = this.inputs.reduce((total, input) => total + input.reachAxis, 0);
    return Math.max(-1, Math.min(1, sum));
  }
}

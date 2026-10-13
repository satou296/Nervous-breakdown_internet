/**
 * W / S の長押しを腕の伸び縮みに変換し、メーター表示を更新する。Updatable。
 * 操作できないとき（達人モード以外・相手の番など）は腕を自然に戻す。
 */
export class ReachController {
  constructor({ keyboard, reach, meter, isEnabled }) {
    this.keyboard = keyboard;
    this.reach = reach;
    this.meter = meter;
    this.isEnabled = isEnabled;
  }

  update(dt) {
    if (this.isEnabled()) this.reach.adjust(this.keyboard.reachAxis, dt);
    else this.reach.relax(dt);
    this.meter.setLevel(this.reach.fraction);
  }
}

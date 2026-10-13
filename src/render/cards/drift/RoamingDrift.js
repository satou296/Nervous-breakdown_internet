const TAU = Math.PI * 2;

/**
 * むずかしい：決められた範囲の中を上下左右に大きく動き回る。
 * 周波数の違う2つの波を重ねるので、動きは不規則に見えるが、
 * ずれは必ず ±range に収まる（重みの合計が 1 のため）。DriftPattern を実装。
 */
export class RoamingDrift {
  static #WEIGHTS = [0.65, 0.35];

  constructor({ range, speed, random = Math.random }) {
    this.range = range;
    const between = (min, max) => min + random() * (max - min);
    this.waves = ['x', 'y', 'z'].map(() => [
      { frequency: between(speed.min, speed.max), phase: random() * TAU },
      { frequency: between(speed.min, speed.max) * 2.3, phase: random() * TAU }
    ]);
  }

  offsetAt(t, out) {
    const [wx, wy, wz] = this.waves.map(waves => this.#sample(waves, t));
    return out.set(wx * this.range.x, wy * this.range.y, wz * this.range.z);
  }

  /** -1〜1 に収まる不規則な波 */
  #sample(waves, t) {
    return waves.reduce((sum, w, i) => sum + Math.sin(t * w.frequency + w.phase) * RoamingDrift.#WEIGHTS[i], 0);
  }
}

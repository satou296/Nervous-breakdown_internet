const TAU = Math.PI * 2;

/**
 * ふつう：定位置のまわりで小さくゆらゆら揺れる。
 *
 * DriftPattern インターフェース：
 *   offsetAt(elapsedSec, out: Vector3): Vector3  … 定位置からのずれを返す
 */
export class CalmDrift {
  constructor({ amplitude, random = Math.random }) {
    this.amplitude = amplitude;
    this.frequency = [0.25 + random() * 0.35, 0.3 + random() * 0.4, 0.2 + random() * 0.35];
    this.phase = [random() * TAU, random() * TAU, random() * TAU];
  }

  offsetAt(t, out) {
    const { amplitude: a, frequency: f, phase: p } = this;
    return out.set(
      Math.sin(t * f[0] + p[0]) * a.x,
      Math.sin(t * f[1] + p[1]) * a.y,
      Math.cos(t * f[2] + p[2]) * a.z
    );
  }
}

/**
 * 弾かれたカードの勢い。受けた衝撃を速度として持ち、空気抵抗で少しずつ止まる。
 * 毎フレーム step() で「このフレームに動く量」を返す。
 */
export class Knockback {
  #velocity = { x: 0, y: 0, z: 0 };
  #spin = 0;
  #displacement = { x: 0, y: 0, z: 0 };

  constructor({ drag, spinDrag = drag }) {
    this.drag = drag;
    this.spinDrag = spinDrag;
  }

  /** 回転の上乗せ分（0 なら通常の速さ） */
  get spinBoost() { return this.#spin; }

  get isMoving() {
    const v = this.#velocity;
    return Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) > 1e-3; // 1mm/秒 未満は止まったとみなす
  }

  apply(impulse, spinKick = 0) {
    this.#velocity.x += impulse.x;
    this.#velocity.y += impulse.y;
    this.#velocity.z += impulse.z;
    this.#spin += spinKick;
  }

  step(dt) {
    const v = this.#velocity;
    const d = this.#displacement;
    d.x = v.x * dt; d.y = v.y * dt; d.z = v.z * dt;
    const decay = Math.exp(-dt * this.drag);
    v.x *= decay; v.y *= decay; v.z *= decay;
    this.#spin *= Math.exp(-dt * this.spinDrag);
    return d;
  }
}

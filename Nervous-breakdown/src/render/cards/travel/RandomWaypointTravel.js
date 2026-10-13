/**
 * 定位置そのものが、浮遊範囲の中をランダムに渡り歩く（極）。AnchorTravel を実装。
 * 範囲内のランダムな目的地へ一定の速さで向かい、着いたら次の目的地と速さを選び直す。
 * 弾かれて定位置がずれても、そこから次の目的地へ向かうだけなので矛盾しない。
 */
export class RandomWaypointTravel {
  #target = null;
  #speed = 0;

  /**
   * @param {object} p
   * @param {() => {x,y,z}} p.pickPoint  範囲内のランダムな点を返す
   * @param {{min:number, max:number}} p.speed  移動の速さ（m/s）
   * @param {number} [p.arriveDistance]  この距離まで近づいたら到着とみなす
   */
  constructor({ pickPoint, speed, arriveDistance = 0.05, random = Math.random }) {
    this.pickPoint = pickPoint;
    this.speedRange = speed;
    this.arriveDistance = arriveDistance;
    this.random = random;
  }

  /** いま向かっている目的地（テスト・デバッグ用） */
  get target() { return this.#target; }

  step(anchor, dt) {
    if (!this.#target) this.#chooseNext();
    const dx = this.#target.x - anchor.x;
    const dy = this.#target.y - anchor.y;
    const dz = this.#target.z - anchor.z;
    const remaining = Math.hypot(dx, dy, dz);
    if (remaining <= this.arriveDistance) {
      this.#chooseNext();
      return;
    }
    const move = Math.min(remaining, this.#speed * dt) / remaining;
    anchor.x += dx * move;
    anchor.y += dy * move;
    anchor.z += dz * move;
  }

  #chooseNext() {
    this.#target = this.pickPoint();
    const { min, max } = this.speedRange;
    this.#speed = min + this.random() * (max - min);
  }
}

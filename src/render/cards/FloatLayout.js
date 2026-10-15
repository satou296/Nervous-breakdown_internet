import { THREE } from '../../lib/three.js';

/**
 * カードの浮遊位置を、互いに重なりすぎないようにランダム配置する。
 * 置き場所が見つからなくなったら最小間隔を少しずつ縮める。
 */
export class FloatLayout {
  constructor({ area, random = Math.random }) {
    this.area = area;
    this.random = random;
  }

  /** 浮遊してよい範囲全体を囲む箱（動き回るカードをこの中に留める） */
  get bounds() {
    const a = this.area;
    const halfWidth = a.baseHalfWidth + a.depth * a.widthGrowth;
    const top = a.minY + a.baseHeight + a.depth * a.heightGrowth;
    return new THREE.Box3(
      new THREE.Vector3(-halfWidth, a.minY - 0.15, a.nearZ - a.depth),
      new THREE.Vector3(halfWidth, top + 0.2, a.nearZ)
    );
  }

  /**
   * @param {() => number} [random] 並びを再現したいときは種付きの乱数を渡す
   * @param {{ widthScale?: number }} [options] 左右の広がりを中央寄りに縮める割合（1 で範囲いっぱい）
   */
  sample(count, random = this.random, { widthScale = 1 } = {}) {
    const { minSpacing } = this.area;
    const points = [];
    let spacing = minSpacing;
    let failures = 0;
    while (points.length < count) {
      const p = this.randomPoint(random, widthScale);
      if (points.every(o => o.distanceTo(p) > spacing)) {
        points.push(p);
        failures = 0;
      } else if (++failures > 300) {
        spacing *= 0.94;
        failures = 0;
      }
    }
    return points;
  }

  /** 浮遊してよい範囲（奥ほど広がる台形）の中のランダムな1点 */
  randomPoint(random = this.random, widthScale = 1) {
    const a = this.area;
    const z = a.nearZ - random() * a.depth;
    const depthIn = -z + a.nearZ; // 0 = 手前
    const halfWidth = (a.baseHalfWidth + depthIn * a.widthGrowth) * widthScale;
    const height = a.baseHeight + depthIn * a.heightGrowth;
    return new THREE.Vector3(
      (random() * 2 - 1) * halfWidth,
      a.minY + random() * height,
      z
    );
  }
}

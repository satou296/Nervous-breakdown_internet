import { THREE } from '../../../lib/three.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

export const Easing = Object.freeze({
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
});

/**
 * 1つの目標姿勢（親・位置・向き・大きさ）へ、時間をかけて移動する手順。
 * 開始時に親を付け替える（見た目の位置はそのまま）。
 *
 * Step インターフェース：
 *   start(object)
 *   step(object, dt): boolean  … 完了したら true
 */
export class PoseTween {
  #t = 0;
  #from = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: 1 };
  #spin = new THREE.Quaternion();

  /**
   * @param {object} p
   * @param {{ parent: THREE.Object3D, position: THREE.Vector3, quaternion: THREE.Quaternion, scale: number }} p.pose
   * @param {number} p.durationSec
   * @param {number} [p.spinTurns]   到着までに縦軸で何回転するか
   * @param {number} [p.arcHeight]   途中で浮き上がる高さ
   */
  constructor({ pose, durationSec, spinTurns = 0, arcHeight = 0, ease = Easing.outCubic }) {
    this.pose = pose;
    this.durationSec = durationSec;
    this.spinTurns = spinTurns;
    this.arcHeight = arcHeight;
    this.ease = ease;
  }

  start(object) {
    if (this.pose.parent && object.parent !== this.pose.parent) this.pose.parent.attach(object);
    this.#from.position.copy(object.position);
    this.#from.quaternion.copy(object.quaternion);
    this.#from.scale = object.scale.x;
    this.#t = 0;
  }

  step(object, dt) {
    this.#t = Math.min(1, this.#t + dt / this.durationSec);
    const e = this.ease(this.#t);
    object.position.lerpVectors(this.#from.position, this.pose.position, e);
    object.position.y += Math.sin(Math.PI * e) * this.arcHeight;
    object.quaternion.slerpQuaternions(this.#from.quaternion, this.pose.quaternion, e);
    if (this.spinTurns) {
      this.#spin.setFromAxisAngle(UP, (1 - e) * TAU * this.spinTurns);
      object.quaternion.multiply(this.#spin);
    }
    object.scale.setScalar(this.#from.scale + (this.pose.scale - this.#from.scale) * e);
    return this.#t >= 1;
  }
}

/** 指定秒数そのまま待つ手順（Step インターフェース） */
export class Wait {
  #t = 0;

  constructor(seconds) {
    this.seconds = seconds;
  }

  start() { this.#t = 0; }

  step(_object, dt) {
    this.#t += dt;
    return this.#t >= this.seconds;
  }
}

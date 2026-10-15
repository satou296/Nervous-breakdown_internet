import { THREE } from '../../../lib/three.js';
import { Knockback } from '../../../physics/Knockback.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * 浮遊状態：定位置（anchor）＋漂い方（drift）の位置へ向かいながら回転する。
 * 本物のトランプと同じく片面にしか数字がないので、うら面を見る人（viewer）へ向けたまま、
 * 面の中でくるくる回り（roll）、ゆらゆら傾く（wobble）。傾きは maxTilt までに抑え、おもて面は見せない。
 * 定位置そのものの動き方は travel（AnchorTravel）に任せる（極では範囲内を渡り歩く）。
 * 腕に当たると、押し出し（push）と弾き（knock）で定位置ごと動く＝散らばる。
 * カードごとに1つ持ち、裏に戻ったときに再利用する。
 *
 * Behavior インターフェース：
 *   pickable: boolean
 *   enter(view, options?)
 *   update(view, dt, elapsed)
 */
export class FloatBehavior {
  pickable = true;
  #target = new THREE.Vector3();
  #offset = new THREE.Vector3();
  #knockback;
  #held = false;
  #facing = new THREE.Matrix4();
  #goal = new THREE.Quaternion();
  #tilt = new THREE.Quaternion();
  #euler = new THREE.Euler();

  /**
   * @param {object} p
   * @param {THREE.Vector3} p.anchor   定位置
   * @param {object} p.drift           DriftPattern（offsetAt を持つ）
   * @param {THREE.Object3D} p.home    浮遊中の親（シーン）
   * @param {THREE.Box3} [p.bounds]    はみ出してはいけない範囲
   * @param {object} [p.travel]        AnchorTravel（step(anchor, dt) を持つ）。省略すると定位置は動かない
   * @param {THREE.Vector3} p.viewer   うら面を向ける相手（プレイヤーの目の位置）
   */
  constructor({
    anchor, drift, home, bounds = null, travel = null, motion, viewer, spinScale = 1, knockDrag = 1.6, random = Math.random
  }) {
    const signed = () => (random() < 0.5 ? -1 : 1);
    this.anchor = anchor.clone();
    this.drift = drift;
    this.home = home;
    this.bounds = bounds;
    this.travel = travel;
    this.motion = motion;
    this.viewer = viewer;
    const { wobble } = motion.float;
    this.spinSpeed = (1.1 + random() * 1.3) * signed() * spinScale;
    this.wobbleSpeed = [0, 1].map(() => (wobble.speed.min + random() * (wobble.speed.max - wobble.speed.min)) * spinScale);
    this.wobblePhase = [0, 1].map(() => random() * Math.PI * 2);
    this.roll = random() * Math.PI * 2;
    this.spin = 1;
    this.#knockback = new Knockback({ drag: knockDrag });
  }

  /** @param {{ fromRest?: boolean }} options 静止状態から戻るときは回転を0から立ち上げる */
  enter(view, { fromRest = false } = {}) {
    if (view.object.parent !== this.home) this.home.attach(view.object);
    if (fromRest) this.spin = 0;
  }

  /** めり込みを解消するため、その場で位置をずらす（定位置も一緒に動く） */
  push(view, offset) {
    this.#moveBy(view, offset);
  }

  /** 手のひらで押さえられている間は、漂わずその場で止まる */
  setHeld(held) {
    this.#held = held;
  }

  /** 弾かれた勢いを加える */
  knock(impulse, spinKick) {
    this.#knockback.apply(impulse, spinKick);
  }

  update(view, dt, t) {
    const { followRate, spinRecoverRate, scale, hoverScale, returnScaleRate } = this.motion;
    const obj = view.object;

    if (this.#knockback.isMoving) this.#moveBy(view, this.#knockback.step(dt));

    if (!this.#held) {
      if (this.travel) {
        this.travel.step(this.anchor, dt);
        if (this.bounds) this.bounds.clampPoint(this.anchor, this.anchor);
      }
      this.#target.copy(this.anchor).add(this.drift.offsetAt(t, this.#offset));
      if (this.bounds) this.bounds.clampPoint(this.#target, this.#target);
      obj.position.lerp(this.#target, 1 - Math.exp(-dt * followRate));
    }

    const spinGoal = this.#held ? 0.15 : 1; // 押さえている間は回転もほぼ止める
    this.spin += (spinGoal - this.spin) * (1 - Math.exp(-dt * (this.#held ? 6 : spinRecoverRate)));
    const spinFactor = this.spin * (1 + this.#knockback.spinBoost) * scale;
    this.roll += this.spinSpeed * dt * spinFactor;
    this.#faceViewer(obj, dt, t);

    const targetScale = 1 + view.hover * hoverScale;
    const s = obj.scale.x + (targetScale - obj.scale.x) * (1 - Math.exp(-dt * returnScaleRate * 3));
    obj.scale.setScalar(s);
  }

  /** うら面を見る人へ向け、面内の回転と、弾かれた勢いの分だけ大きくなる傾きを足す */
  #faceViewer(obj, dt, t) {
    const { wobble, maxTilt, turnRate } = this.motion.float;
    const amount = Math.min(maxTilt, wobble.angle * this.spin * this.motion.scale * (1 + this.#knockback.spinBoost));
    this.#euler.set(
      Math.sin(t * this.wobbleSpeed[0] + this.wobblePhase[0]) * amount,
      Math.sin(t * this.wobbleSpeed[1] + this.wobblePhase[1]) * amount,
      this.roll
    );
    // Matrix4.lookAt(eye, target) は +Z を eye - target に向ける＝おもて面を見る人と反対へ
    this.#facing.lookAt(obj.position, this.viewer, UP);
    this.#goal.setFromRotationMatrix(this.#facing).multiply(this.#tilt.setFromEuler(this.#euler));
    obj.quaternion.slerp(this.#goal, 1 - Math.exp(-dt * turnRate));
  }

  #moveBy(view, d) {
    this.anchor.x += d.x; this.anchor.y += d.y; this.anchor.z += d.z;
    if (this.bounds) this.bounds.clampPoint(this.anchor, this.anchor);
    const p = view.object.position;
    p.x += d.x; p.y += d.y; p.z += d.z;
    if (this.bounds) this.bounds.clampPoint(p, p);
  }
}

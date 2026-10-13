import { closestPointOnSegment, distance, directionBetween, scaled } from './vectorMath.js';

/**
 * 腕に当たったカードを押しのけて弾き飛ばす（散らばる）。Updatable（ゲーム内時計で動かす）。
 * 腕は「肩→手首」「手首→指先」の2本のカプセル、カードは球として扱う。
 * 手のひらで触れているカード（isExempt が true）は、選べるよう弾かない。
 *
 * arm  : { contactPoints(): { shoulder, wrist, tip } }（ワールド座標）
 * field: { views: CardView[] }  CardView は isPickable / object.position / push() / knock() を持つ
 */
export class ArmCollisionResolver {
  #contacts = new Set();
  #previousTip = null;
  #closest = { x: 0, y: 0, z: 0 };
  #candidate = { x: 0, y: 0, z: 0 };

  /**
   * @param {object} p
   * @param {(view, impulse, spin) => void} [p.onKnock]  弾いたことを知らせる（オンラインでは全員に伝える）
   */
  constructor({ arm, field, isEnabled, isExempt = () => false, onKnock = () => {}, config }) {
    this.arm = arm;
    this.onKnock = onKnock;
    this.field = field;
    this.isEnabled = isEnabled;
    this.isExempt = isExempt;
    this.config = config;
  }

  update(dt) {
    if (!this.isEnabled()) {
      this.#contacts.clear();
      this.#previousTip = null;
      return;
    }
    const { shoulder, wrist, tip } = this.arm.contactPoints();
    const tipSpeed = this.#trackTipSpeed(tip, dt);
    const hitDistance = this.config.armRadius + this.config.cardRadius;
    const touching = new Set();

    for (const view of this.field.views) {
      if (!view.isPickable || this.isExempt(view)) continue;
      const center = view.object.position;
      const gap = this.#distanceToArm(center, shoulder, wrist, tip);
      if (gap >= hitDistance) continue;

      touching.add(view);
      const away = directionBetween(this.#closest, center);
      view.push(scaled(away, hitDistance - gap)); // めり込んだ分だけ押し出す
      if (!this.#contacts.has(view)) this.#knock(view, away, tipSpeed); // 当たった瞬間だけ弾く
    }
    this.#contacts = touching;
  }

  /** 腕（2本の線分）までの最短距離。最も近い点は #closest に入る */
  #distanceToArm(point, shoulder, wrist, tip) {
    closestPointOnSegment(point, shoulder, wrist, this.#closest);
    let best = distance(point, this.#closest);
    closestPointOnSegment(point, wrist, tip, this.#candidate);
    const d = distance(point, this.#candidate);
    if (d < best) {
      best = d;
      Object.assign(this.#closest, this.#candidate);
    }
    return best;
  }

  #knock(view, away, tipSpeed) {
    const { impulseBase, impulseFromSpeed, maxImpulse, spinKick } = this.config;
    const strength = Math.min(maxImpulse, impulseBase + tipSpeed * impulseFromSpeed);
    const impulse = scaled(away, strength);
    view.knock(impulse, spinKick);
    this.onKnock(view, impulse, spinKick);
  }

  #trackTipSpeed(tip, dt) {
    const prev = this.#previousTip;
    const speed = prev && dt > 0 ? distance(prev, tip) / dt : 0;
    this.#previousTip = { x: tip.x, y: tip.y, z: tip.z };
    return speed;
  }
}

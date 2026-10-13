import { distance } from './vectorMath.js';

/**
 * 手のひらがどのカードに触れているかを調べる。Updatable（ゲーム内時計で動かす）。
 * 触れているカードは「いちばん近い1枚」だけ。触れただけでは選ばない（選ぶのはクリック）。
 * 一度触れたカードは、少し離れる（releaseRadius）まで触れたままとみなす（表示がちらつかないように）。
 *
 * arm  : { contactPoints(): { palm } }（ワールド座標）
 * field: { views: CardView[] }  CardView は isPickable / object.position を持つ
 */
export class PalmContactSensor {
  #current = null;

  constructor({ arm, field, isEnabled, palmRadius, releaseRadius = palmRadius * 1.4 }) {
    this.arm = arm;
    this.field = field;
    this.isEnabled = isEnabled;
    this.palmRadius = palmRadius;
    this.releaseRadius = releaseRadius;
  }

  /** いま手のひらが触れているカード（なければ null） */
  get current() { return this.#current; }

  update() {
    if (!this.isEnabled()) {
      this.#current = null;
      return;
    }
    if (this.#stillTouching(this.#current)) return;
    this.#current = this.#nearestTouching();
  }

  #stillTouching(view) {
    if (!view?.isPickable) return false;
    const { palm } = this.arm.contactPoints();
    return distance(palm, view.object.position) < this.releaseRadius;
  }

  #nearestTouching() {
    const { palm } = this.arm.contactPoints();
    let best = null;
    let bestDistance = this.palmRadius;
    for (const view of this.field.views) {
      if (!view.isPickable) continue;
      const d = distance(palm, view.object.position);
      if (d < bestDistance) {
        best = view;
        bestDistance = d;
      }
    }
    return best;
  }
}

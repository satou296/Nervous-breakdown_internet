import { THREE } from '../../lib/three.js';

/**
 * 画面上の位置（正規化デバイス座標）から、そこにある選択可能なカードを探す。
 */
export class CardPicker {
  #raycaster = new THREE.Raycaster();

  constructor({ camera, field }) {
    this.camera = camera;
    this.field = field;
  }

  /** @param {{x:number, y:number}} ndc  -1〜1 の画面座標 */
  pick(ndc) {
    this.#raycaster.setFromCamera(ndc, this.camera);
    const hit = this.#raycaster.intersectObjects(this.field.pickTargets(), false)[0];
    return hit ? hit.object.userData.cardView : null;
  }
}

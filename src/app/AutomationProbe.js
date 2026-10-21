import { THREE } from '../lib/three.js';

/**
 * 自動テスト（E2E）向けの窓口。いま狙ってクリックできるカードの、画面上の位置を答える。
 * main.js が、ブラウザが自動操作されているとき（navigator.webdriver）だけ window に出す。
 * カードの中身（数字・マーク）は返さない（オンラインで裏向きのカードを秘密にしているため）。
 */
export class AutomationProbe {
  #center = new THREE.Vector3();

  constructor({ camera, field, picker, canvas }) {
    this.camera = camera;
    this.field = field;
    this.picker = picker;
    this.canvas = canvas;
  }

  /**
   * @returns {{ id: number, pickable: boolean, x?: number, y?: number }[]}
   *   x・y（CSS ピクセル）は、そこをクリックすればそのカードが選ばれるときだけ入る
   *   （真横を向いている・ほかのカードや説明パネルの陰になっているときは入らない）
   */
  cards() {
    return this.field.views.map(view => {
      const entry = { id: view.card.id, pickable: view.isPickable };
      const point = view.isPickable ? this.#aimPoint(view) : null;
      return point ? { ...entry, ...point } : entry;
    });
  }

  #aimPoint(view) {
    const ndc = view.object.getWorldPosition(this.#center).project(this.camera);
    if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z > 1) return null;
    if (this.picker.pick(ndc) !== view) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = rect.left + (ndc.x + 1) / 2 * rect.width;
    const y = rect.top + (1 - ndc.y) / 2 * rect.height;
    if (document.elementFromPoint(x, y) !== this.canvas) return null;
    return { x, y };
  }
}

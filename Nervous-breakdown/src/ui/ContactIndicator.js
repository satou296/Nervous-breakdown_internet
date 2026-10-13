/**
 * 「手のひらがカードに触れています・左クリックでめくる」の表示。
 * 表になったカードを並べる画面下部の、すぐ上に出す。
 */
export class ContactIndicator {
  #visible = false;

  constructor(element) {
    this.element = element;
  }

  show() {
    if (this.#visible) return;
    this.#visible = true;
    this.element.hidden = false;
  }

  hide() {
    if (!this.#visible) return;
    this.#visible = false;
    this.element.hidden = true;
  }
}

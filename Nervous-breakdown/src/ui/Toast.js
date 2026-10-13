/**
 * 画面中央に短く出すメッセージ。
 */
export class Toast {
  #timer = null;

  constructor(element, { durationMs }) {
    this.element = element;
    this.durationMs = durationMs;
  }

  /** @param {'good'|'bad'|undefined} tone */
  show(message, tone) {
    this.element.textContent = message;
    this.element.className = ['show', tone].filter(Boolean).join(' ');
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.element.className = ''; }, this.durationMs);
  }
}

/**
 * 達人モードで出す「腕の長さ」メーター。
 */
export class ReachMeter {
  #lastPercent = -1;

  constructor({ root, fill }) {
    this.root = root;
    this.fill = fill;
  }

  show() { this.root.hidden = false; }
  hide() { this.root.hidden = true; }

  /** @param {number} level 0〜1 */
  setLevel(level) {
    const percent = Math.round(level * 100);
    if (percent === this.#lastPercent) return;
    this.#lastPercent = percent;
    this.fill.style.width = `${percent}%`;
    this.root.setAttribute('aria-valuenow', String(percent));
  }
}

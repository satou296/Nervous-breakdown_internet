import { escapeHtml, formatTime } from './format.js';
import { TEXT } from '../config/strings.js';

/**
 * プレイ中の表示（手番・残りペア・得点・タイム・操作ヘルプ）。
 * 表示用のデータを受け取って描くだけで、ゲームの状態は持たない。
 */
export class Hud {
  #clockEl = null;

  constructor({ root, turnEl, scoresEl, helpEl }) {
    this.root = root;
    this.turnEl = turnEl;
    this.scoresEl = scoresEl;
    this.helpEl = helpEl;
  }

  show() { this.root.hidden = false; this.helpEl.hidden = false; }

  /** 画面下の操作説明を差し替える */
  setHelp(text) { this.helpEl.textContent = text; }
  hide() { this.root.hidden = true; this.helpEl.hidden = true; }

  /**
   * @param {{ turnLabel: string, remainingPairs: number, turnCount: number|null,
   *           players: {name:string, pairs:number}[], activeIndex: number|null, showClock: boolean }} view
   */
  render(view) {
    const turns = view.turnCount === null ? '' : TEXT.turnsSuffix(view.turnCount);
    this.turnEl.innerHTML = `${escapeHtml(view.turnLabel)}<small>${TEXT.remaining(view.remainingPairs)}${turns}</small>`;

    const chips = view.players.map((p, i) => this.#chip(p.name, p.pairs, TEXT.pairUnit, i === view.activeIndex));
    if (view.showClock) chips.push(this.#chip(TEXT.clock, '0:00', '', false, 'hud-clock'));
    this.scoresEl.innerHTML = chips.join('');
    this.#clockEl = this.scoresEl.querySelector('#hud-clock');
  }

  updateClock(ms) {
    if (this.#clockEl) this.#clockEl.textContent = formatTime(ms);
  }

  #chip(name, value, unit, active, valueId) {
    const id = valueId ? ` id="${valueId}"` : '';
    const unitHtml = unit ? `<span class="unit">${escapeHtml(unit)}</span>` : '';
    return `<div class="chip${active ? ' active' : ''}"><span class="nm">${escapeHtml(name)}</span>`
      + `<span class="sc"><span${id}>${escapeHtml(value)}</span>${unitHtml}</span></div>`;
  }
}

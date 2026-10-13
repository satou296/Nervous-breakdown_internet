import { EventEmitter } from '../core/EventEmitter.js';
import { escapeHtml } from './format.js';

export const ResultEvent = Object.freeze({ PlayAgain: 'playAgain', BackToMenu: 'backToMenu' });

/**
 * 結果画面。整形済みの内容（eyebrow / title / stats）を表示するだけ。
 */
export class ResultScreen extends EventEmitter {
  constructor({ root, eyebrowEl, titleEl, statsEl, againButton, menuButton }) {
    super();
    Object.assign(this, { root, eyebrowEl, titleEl, statsEl, againButton });
    againButton.addEventListener('click', () => this.emit(ResultEvent.PlayAgain));
    menuButton.addEventListener('click', () => this.emit(ResultEvent.BackToMenu));
  }

  get isOpen() { return !this.root.hidden; }

  show({ eyebrow, title, stats }) {
    this.eyebrowEl.textContent = eyebrow;
    this.titleEl.textContent = title;
    this.statsEl.innerHTML = stats
      .map(([k, v]) => `<div class="stat"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`)
      .join('');
    this.root.hidden = false;
    this.againButton.focus();
  }

  hide() {
    this.root.hidden = true;
  }
}

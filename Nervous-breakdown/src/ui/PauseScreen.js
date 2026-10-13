import { EventEmitter } from '../core/EventEmitter.js';

export const PauseScreenEvent = Object.freeze({ Resume: 'resume', Quit: 'quit' });

/**
 * ポーズ画面。「続ける」「スタート画面に戻る」の選択を通知するだけ。
 */
export class PauseScreen extends EventEmitter {
  constructor({ root, resumeButton, quitButton, noteEl = null }) {
    super();
    this.root = root;
    this.noteEl = noteEl;
    this.resumeButton = resumeButton;
    resumeButton.addEventListener('click', () => this.emit(PauseScreenEvent.Resume));
    quitButton.addEventListener('click', () => this.emit(PauseScreenEvent.Quit));
  }

  get isOpen() { return !this.root.hidden; }

  /** @param {{ note?: string }} [options] 補足（オンラインでは「時間は止まりません」） */
  show({ note = '' } = {}) {
    if (this.noteEl) {
      this.noteEl.textContent = note;
      this.noteEl.hidden = !note;
    }
    this.root.hidden = false;
    this.resumeButton.focus();
  }

  hide() {
    this.root.hidden = true;
  }
}

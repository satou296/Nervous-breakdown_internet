import { EventEmitter } from '../core/EventEmitter.js';

export const TutorialScreenEvent = Object.freeze({ Skip: 'skip', Finish: 'finish' });

/**
 * チュートリアルの説明パネル。プレイ画面の上に重ねて、操作を邪魔しない位置に出す。
 * 「スキップ」（遊んだことがある人向け）と、終わったときの「ゲームをはじめる」を通知するだけ。
 */
export class TutorialScreen extends EventEmitter {
  constructor({ root, textEl, progressEl, skipButton, finishButton }) {
    super();
    Object.assign(this, { root, textEl, progressEl, skipButton, finishButton });
    skipButton.addEventListener('click', () => this.emit(TutorialScreenEvent.Skip));
    finishButton.addEventListener('click', () => this.emit(TutorialScreenEvent.Finish));
  }

  get isOpen() { return !this.root.hidden; }

  /**
   * @param {{ text: string, progress: string, done: boolean }} view
   */
  show({ text, progress, done }) {
    this.textEl.textContent = text;
    this.progressEl.textContent = progress;
    this.finishButton.hidden = !done;
    this.skipButton.hidden = done;
    this.root.classList.toggle('done', done);
    this.root.hidden = false;
    if (done) this.finishButton.focus();
  }

  hide() {
    this.root.hidden = true;
  }
}

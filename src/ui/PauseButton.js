import { EventEmitter } from '../core/EventEmitter.js';

export const PauseButtonEvent = Object.freeze({ Press: 'press' });

/**
 * プレイ中に画面に出す「一時停止」ボタン。
 */
export class PauseButton extends EventEmitter {
  constructor(element) {
    super();
    this.element = element;
    element.addEventListener('click', () => this.emit(PauseButtonEvent.Press));
  }

  show() { this.element.hidden = false; }
  hide() { this.element.hidden = true; }
}

import { EventEmitter } from '../core/EventEmitter.js';

export const ReachPadEvent = Object.freeze({ Flip: 'flip' });

/**
 * 達人・極の操作ボタン（タッチが主な端末だけで出す）。
 * 「伸ばす」「縮める」は長押しの間だけ KeyboardInput と同じ形の reachAxis（伸ばす +1／縮める -1）を返し、
 * 「めくる」は Flip を通知する（画面をタップすると狙いが指の位置へ動くので、狙いを変えずにめくれるように）。
 */
export class ReachPad extends EventEmitter {
  #pressed = new Set();

  /** @param {boolean} p.enabled タッチが主な端末か（false なら show() しても出さない） */
  constructor({ root, extendButton, retractButton, flipButton, enabled }) {
    super();
    this.root = root;
    this.enabled = enabled;
    this.#bindHold(extendButton, 1);
    this.#bindHold(retractButton, -1);
    flipButton.addEventListener('click', () => this.emit(ReachPadEvent.Flip));
  }

  get reachAxis() {
    let axis = 0;
    for (const direction of this.#pressed) axis += direction;
    return axis;
  }

  show() {
    if (this.enabled) this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
    this.#pressed.clear();
  }

  #bindHold(button, direction) {
    const release = () => this.#pressed.delete(direction);
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      button.setPointerCapture?.(e.pointerId);
      this.#pressed.add(direction);
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('contextmenu', e => e.preventDefault());
  }
}

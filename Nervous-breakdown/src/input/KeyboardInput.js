import { EventEmitter } from '../core/EventEmitter.js';

export const KeyboardInputEvent = Object.freeze({ Escape: 'escape' });

const LOOK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
/** 腕の伸縮は物理キー位置（KeyW / KeyS）で判定する：日本語入力やキー配列に左右されない */
const REACH_CODES = new Set(['KeyW', 'KeyS']);

/**
 * キーボード入力。見回し（矢印キー）と腕の伸縮（W / S）の押下状態、Esc の通知を扱う。
 * 「押されているか」を返すだけで、それを何に使うかは知らない。
 */
export class KeyboardInput extends EventEmitter {
  #pressedKeys = new Set();
  #pressedCodes = new Set();
  #lookEnabled = () => true;
  #reachEnabled = () => false;

  constructor(target = window) {
    super();
    target.addEventListener('keydown', this.#onDown);
    target.addEventListener('keyup', e => {
      this.#pressedKeys.delete(e.key);
      this.#pressedCodes.delete(e.code);
    });
    target.addEventListener('blur', () => {
      this.#pressedKeys.clear();
      this.#pressedCodes.clear();
    });
  }

  /** 見回しキーを受け付けるかどうか（メニュー表示中は無効にする等） */
  setLookEnabled(predicate) {
    this.#lookEnabled = predicate;
  }

  /** 腕の伸縮キーを受け付けるかどうか（達人モードのプレイ中だけ有効にする等） */
  setReachEnabled(predicate) {
    this.#reachEnabled = predicate;
  }

  /** 見回しの入力軸。yaw: 左が +1、pitch: 上が +1 */
  get lookAxis() {
    if (!this.#lookEnabled()) return { yaw: 0, pitch: 0 };
    const has = k => (this.#pressedKeys.has(k) ? 1 : 0);
    return {
      yaw: has('ArrowLeft') - has('ArrowRight'),
      pitch: has('ArrowUp') - has('ArrowDown')
    };
  }

  /** 腕の入力軸。W で +1（伸ばす）、S で -1（縮める） */
  get reachAxis() {
    if (!this.#reachEnabled()) return 0;
    const has = c => (this.#pressedCodes.has(c) ? 1 : 0);
    return has('KeyW') - has('KeyS');
  }

  #onDown = (e) => {
    if (e.key === 'Escape') {
      this.emit(KeyboardInputEvent.Escape);
      return;
    }
    if (LOOK_KEYS.has(e.key) && this.#lookEnabled()) {
      this.#pressedKeys.add(e.key);
      e.preventDefault();
    }
    if (REACH_CODES.has(e.code) && this.#reachEnabled()) {
      this.#pressedCodes.add(e.code);
      e.preventDefault();
    }
  };
}

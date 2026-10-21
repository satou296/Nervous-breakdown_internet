import { EventEmitter } from '../core/EventEmitter.js';

export const MenuEvent = Object.freeze({ Start: 'start', Tutorial: 'tutorial' });

/**
 * 開始メニュー。選ばれたモード・難易度・枚数を Start イベントで、「遊び方を見る」を Tutorial イベントで通知する。
 * （サンドボックス内でも動くよう、フォーム送信ではなくボタンのクリックで扱う）
 */
export class MenuScreen extends EventEmitter {
  constructor({ root, startButton, tutorialButton, defaults }) {
    super();
    this.root = root;
    this.startButton = startButton;
    this.defaults = defaults;
    tutorialButton.addEventListener('click', () => this.emit(MenuEvent.Tutorial));
    startButton.addEventListener('click', () => {
      this.emit(MenuEvent.Start, {
        modeId: this.#checkedValue('mode') ?? defaults.modeId,
        difficultyId: this.#checkedValue('difficulty') ?? defaults.difficultyId,
        deckSize: Number(this.#checkedValue('count') ?? defaults.deckSize)
      });
    });
  }

  get isOpen() { return !this.root.hidden; }

  /** オンライン対戦の選択肢を有効／無効にする（サーバーがない場所では選べない） */
  setOnlineAvailable(available, unavailableNote) {
    const input = this.root.querySelector('input[name="mode"][value="online"]');
    if (!input) return;
    input.disabled = !available;
    const note = this.root.querySelector(`label[for="${input.id}"] small`);
    if (note && !available) note.textContent = unavailableNote;
    if (!available && input.checked) this.root.querySelector('input[name="mode"]').checked = true;
  }

  show() {
    this.root.hidden = false;
    this.startButton.focus();
  }

  hide() {
    this.root.hidden = true;
  }

  #checkedValue(name) {
    return this.root.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
  }
}

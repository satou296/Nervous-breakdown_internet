/**
 * ポーズの状態を一か所で管理する。
 * 止める・再開するときに、ゲーム内時計と画面表示を必ず揃えて切り替える。
 * オンライン対戦のように時間を止められないときは freeze: false で、メニューだけを開く。
 */
export class PauseController {
  #paused = false;

  constructor({ clock, screen, button }) {
    this.clock = clock;
    this.screen = screen;
    this.button = button;
  }

  get isPaused() { return this.#paused; }

  /** @param {{ freeze?: boolean, note?: string }} [options] */
  pause({ freeze = true, note = '' } = {}) {
    if (this.#paused) return;
    this.#paused = true;
    if (freeze) this.clock.pause();
    this.button.hide();
    this.screen.show({ note });
  }

  resume() {
    if (!this.#paused) return;
    this.#paused = false;
    this.screen.hide();
    this.button.show();
    this.clock.resume();
  }

  /** プレイを終えるとき：ポーズを解除し、ボタンも隠す */
  reset() {
    this.#paused = false;
    this.screen.hide();
    this.button.hide();
    this.clock.resume();
  }

  /** プレイを始めるとき：ボタンを出す */
  activate() {
    this.reset();
    this.button.show();
  }
}

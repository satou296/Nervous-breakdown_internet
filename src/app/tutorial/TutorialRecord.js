/**
 * チュートリアルを見終えたか（スキップを含む）を、このブラウザに覚えておく（DOM 非依存。保存先は注入できる）。
 * 保存できない環境（プライベートウィンドウ等）では、毎回「まだ見ていない」として扱う。
 */
export class TutorialRecord {
  static #KEY = 'fc.tutorialSeen';

  constructor({ storage = TutorialRecord.#storage() } = {}) {
    this.storage = storage;
  }

  get seen() {
    try { return this.storage?.getItem(TutorialRecord.#KEY) === '1'; } catch { return false; }
  }

  markSeen() {
    try { this.storage?.setItem(TutorialRecord.#KEY, '1'); } catch { /* 保存できなくても続ける */ }
  }

  static #storage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
  }
}

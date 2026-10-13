/**
 * 手番の管理。誰の番か、次は誰か、だけを扱う。
 */
export class TurnOrder {
  #index = 0;

  constructor(players) {
    if (!players.length) throw new Error('プレイヤーが1人以上必要です');
    this.players = Object.freeze([...players]);
  }

  get current() { return this.players[this.#index]; }
  get currentIndex() { return this.#index; }

  advance() {
    this.#index = (this.#index + 1) % this.players.length;
    return this.current;
  }
}

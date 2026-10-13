/**
 * ルール上のカード。見た目（3D）とは無関係に、ランク・スート・状態だけを持つ。
 */
export const CardState = Object.freeze({
  FaceDown: 'faceDown',
  FaceUp: 'faceUp',
  Matched: 'matched'
});

export class Card {
  #state = CardState.FaceDown;

  constructor(id, rank, suit) {
    this.id = id;
    this.rank = rank;
    this.suit = suit;
    Object.freeze(this);
  }

  get state() { return this.#state; }
  get isSelectable() { return this.#state === CardState.FaceDown; }
  get isInPlay() { return this.#state !== CardState.Matched; }

  turnUp() {
    if (!this.isSelectable) throw new Error(`カード ${this.id} は表にできない状態です（${this.#state}）`);
    this.#state = CardState.FaceUp;
  }

  turnDown() {
    if (this.#state !== CardState.FaceUp) return;
    this.#state = CardState.FaceDown;
  }

  markMatched() {
    this.#state = CardState.Matched;
  }
}

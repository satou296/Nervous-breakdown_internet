/**
 * メニュー表示中の背景演出：フルデッキを宙に浮かべておく。
 */
export class AttractMode {
  constructor({ field, deckFactory, maxRank, difficulty }) {
    this.field = field;
    this.deckFactory = deckFactory;
    this.maxRank = maxRank;
    this.difficulty = difficulty;
  }

  show() {
    this.field.populate(this.deckFactory.create(this.maxRank), this.difficulty);
  }

  hide() {
    this.field.clear();
  }
}

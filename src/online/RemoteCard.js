/**
 * オンライン対戦の画面側のカード。
 * 最初は番号（id）しか知らず、めくられたときにサーバーから数字とマークを教えてもらう。
 * CardView が使う id / rank / suit を持つ。
 */
export class RemoteCard {
  rank = null;
  suit = null;

  constructor(id) {
    this.id = id;
  }

  get isKnown() { return this.rank !== null; }

  reveal(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }
}

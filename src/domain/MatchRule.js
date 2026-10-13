/**
 * 2枚が「ペア」かを判定する戦略。
 * ルールを変えたいとき（同じ色＋同じ数字など）は同じインターフェースのクラスを追加して差し替える。
 *
 * interface MatchRule { isMatch(a: Card, b: Card): boolean }
 */
export class SameRankRule {
  isMatch(a, b) {
    return a.rank === b.rank;
  }
}

/** 例：同じ数字かつ同じ色でペアとする派生ルール */
export class SameRankAndColorRule {
  constructor(isRed) {
    this.isRed = isRed;
  }

  isMatch(a, b) {
    return a.rank === b.rank && this.isRed(a.suit) === this.isRed(b.suit);
  }
}

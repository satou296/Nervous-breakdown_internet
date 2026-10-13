/**
 * Fisher–Yates シャッフル。乱数源を注入できるのでテストで再現可能。
 */
export class FisherYatesShuffler {
  constructor(random = Math.random) {
    this.random = random;
  }

  /** 元の配列は変更せず、並べ替えた新しい配列を返す */
  shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

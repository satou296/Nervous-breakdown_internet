import { Card } from './Card.js';
import { SUITS, MAX_RANK } from './Suit.js';

/**
 * 山札を作る。A〜maxRank の4スートを揃え、シャッフルしてから番号（id）を振る。
 * シャッフル後に番号を振るので、番号からカードの数字やマークは推測できない
 * （オンライン対戦では番号だけを全員に配るため）。
 */
export class DeckFactory {
  constructor(shuffler) {
    this.shuffler = shuffler;
  }

  create(maxRank) {
    if (maxRank < 1 || maxRank > MAX_RANK) throw new RangeError(`maxRank は 1〜${MAX_RANK} です`);
    const faces = [];
    for (let rank = 1; rank <= maxRank; rank++) {
      for (const suit of SUITS) faces.push({ rank, suit: suit.id });
    }
    return this.createFrom(faces);
  }

  /**
   * 決められた札だけで山札を作る（チュートリアル用）。シャッフルしてから番号を振るのは create と同じ。
   * @param {{ rank: number, suit: number }[]} faces
   */
  createFrom(faces) {
    for (const { rank } of faces) {
      if (!(rank >= 1 && rank <= MAX_RANK)) throw new RangeError(`rank は 1〜${MAX_RANK} です`);
    }
    return this.shuffler.shuffle([...faces]).map((face, id) => new Card(id, face.rank, face.suit));
  }
}

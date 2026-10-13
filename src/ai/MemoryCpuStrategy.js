/**
 * CPU のカード選択戦略。
 * 覚えているペアがあればそれを取り、なければ未知のカードをめくる。
 *
 * interface CpuStrategy {
 *   chooseFirst(cards: Card[]): Card | null
 *   chooseSecond(first: Card, cards: Card[]): Card | null
 * }
 */
export class MemoryCpuStrategy {
  constructor({ memory, matchRule, random = Math.random }) {
    this.memory = memory;
    this.matchRule = matchRule;
    this.random = random;
  }

  chooseFirst(cards) {
    const known = this.memory.knownSelectable();
    for (const a of known) {
      if (known.some(b => b !== a && this.matchRule.isMatch(a, b))) return a;
    }
    const selectable = cards.filter(c => c.isSelectable);
    return this.#pickRandom(this.#preferUnknown(selectable));
  }

  chooseSecond(first, cards) {
    const knownPartner = this.memory.knownSelectable()
      .find(c => c !== first && this.matchRule.isMatch(first, c));
    if (knownPartner) return knownPartner;
    const pool = cards.filter(c => c.isSelectable && c !== first);
    return this.#pickRandom(this.#preferUnknown(pool));
  }

  #preferUnknown(cards) {
    const unknown = cards.filter(c => !this.memory.knows(c));
    return unknown.length ? unknown : cards;
  }

  #pickRandom(cards) {
    return cards.length ? cards[Math.floor(this.random() * cards.length)] : null;
  }
}

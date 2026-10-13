/**
 * CPU の記憶。見たカードを一定確率で覚え、取られたカードは忘れる。
 */
export class CpuMemory {
  #known = new Set();

  constructor({ rememberChance, random = Math.random }) {
    this.rememberChance = rememberChance;
    this.random = random;
  }

  observe(card) {
    if (this.random() < this.rememberChance) this.#known.add(card);
  }

  forget(card) {
    this.#known.delete(card);
  }

  knows(card) {
    return this.#known.has(card);
  }

  /** 覚えていて、まだ裏向きで選べるカード */
  knownSelectable() {
    return [...this.#known].filter(c => c.isSelectable);
  }

  clear() {
    this.#known.clear();
  }
}

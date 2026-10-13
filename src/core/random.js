/**
 * 種（seed）から毎回同じ並びを作る乱数。
 * オンライン対戦では全員に同じ種を配り、カードの浮遊を全員の画面でそろえる。
 */

/** mulberry32：軽くて偏りの少ない 32bit 乱数。0 以上 1 未満を返す関数を作る */
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 種と番号から、別の種を作る（カードごとに独立した乱数にするため） */
export function deriveSeed(seed, salt) {
  let h = (seed ^ Math.imul((salt + 0x9e3779b9) | 0, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 新しい種をでたらめに作る */
export function randomSeed(random = Math.random) {
  return Math.floor(random() * 4294967296) >>> 0;
}

/**
 * トランプのスートとランクの定義（純粋なデータ）。
 */
export const Suit = Object.freeze({
  Spade: 0,
  Heart: 1,
  Diamond: 2,
  Club: 3
});

export const SUITS = Object.freeze([
  Object.freeze({ id: Suit.Spade, key: 'spade', isRed: false }),
  Object.freeze({ id: Suit.Heart, key: 'heart', isRed: true }),
  Object.freeze({ id: Suit.Diamond, key: 'diamond', isRed: true }),
  Object.freeze({ id: Suit.Club, key: 'club', isRed: false })
]);

const RANK_LABELS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);

export const MAX_RANK = RANK_LABELS.length;

export function rankLabel(rank) {
  return RANK_LABELS[rank - 1];
}

export function isRedSuit(suit) {
  return SUITS[suit].isRed;
}

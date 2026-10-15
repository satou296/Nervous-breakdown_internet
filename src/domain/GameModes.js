import { Player, PlayerKind } from './Player.js';
import { TEXT } from '../config/strings.js';
import { Suit } from './Suit.js';

/**
 * 遊び方の定義。座席（プレイヤー）と、取ったカードの置き場所（pile）を宣言的に持つ。
 * 新しい遊び方は、ここにエントリを追加するだけで増やせる。
 *
 * pile: 'hand'  … 自分の左手の上に積む
 *       'table' … テーブルの奥に積む
 * deck: 使う札を決めておく遊び方だけが持つ（省略すると、選んだ枚数の山札を使う）
 * realCards: true なら本物と同じ両面（表と裏）のカードにする（省略すると、選ぶまで両面とも裏・選んだら両面とも表）
 */
export const GAME_MODES = Object.freeze({
  solo: Object.freeze({
    id: 'solo',
    seats: [{ name: TEXT.you, kind: PlayerKind.Human, pile: 'hand' }],
    announceTurns: false,
    showClock: true,
    showTurnCount: true
  }),
  cpu: Object.freeze({
    id: 'cpu',
    seats: [
      { name: TEXT.you, kind: PlayerKind.Human, pile: 'hand' },
      { name: TEXT.cpu, kind: PlayerKind.Cpu, pile: 'table' }
    ],
    announceTurns: true,
    showClock: false,
    showTurnCount: false
  }),
  /** 最初に開くチュートリアル：エース・数札・絵札を1ペアずつ、計6枚（難易度は TUTORIAL_DIFFICULTY） */
  tutorial: Object.freeze({
    id: 'tutorial',
    seats: [{ name: TEXT.you, kind: PlayerKind.Human, pile: 'hand' }],
    announceTurns: false,
    showClock: false,
    showTurnCount: false,
    realCards: true,
    deck: Object.freeze([
      { rank: 1, suit: Suit.Spade }, { rank: 1, suit: Suit.Heart },
      { rank: 7, suit: Suit.Diamond }, { rank: 7, suit: Suit.Club },
      { rank: 13, suit: Suit.Heart }, { rank: 13, suit: Suit.Spade }
    ].map(Object.freeze))
  }),
  duo: Object.freeze({
    id: 'duo',
    seats: [
      { name: TEXT.player(1), kind: PlayerKind.Human, pile: 'hand' },
      { name: TEXT.player(2), kind: PlayerKind.Human, pile: 'table' }
    ],
    announceTurns: true,
    showClock: false,
    showTurnCount: false
  })
});

export function getGameMode(id) {
  const mode = GAME_MODES[id];
  if (!mode) throw new Error(`未知のモードです: ${id}`);
  return mode;
}

export function createPlayers(mode) {
  return mode.seats.map(seat => new Player({ name: seat.name, kind: seat.kind }));
}

export function isSolo(mode) {
  return mode.seats.length === 1;
}

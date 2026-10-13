import { PlayerKind } from '../domain/Player.js';
import { TEXT } from '../config/strings.js';

/**
 * オンライン対戦の「遊び方」の定義を、参加者に合わせて作る（GameModes と同じ形）。
 * 自分が取ったカードは左手に、他の人のカードはテーブルの奥に左から順に積む。
 */
export function createOnlineMode(playerNames, youIndex) {
  let othersOrder = 0;
  return Object.freeze({
    id: 'online',
    seats: playerNames.map((name, i) => {
      const isYou = i === youIndex;
      return {
        name: isYou ? TEXT.online.youSuffix(name) : name,
        kind: PlayerKind.Human,
        pile: isYou ? 'hand' : 'table',
        pileSlot: isYou ? 0 : ++othersOrder
      };
    }),
    announceTurns: true,
    showClock: false,
    showTurnCount: false
  });
}

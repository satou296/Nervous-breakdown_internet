import { TEXT } from '../config/strings.js';
import { formatTime } from './format.js';
import { isSolo } from '../domain/GameModes.js';

/**
 * ゲーム結果（summary）を、結果画面に出す見出しと数値に変換する。
 */
export class ResultFormatter {
  format(summary, mode, difficulty) {
    const r = TEXT.result;
    const difficultyStat = [r.difficulty, difficulty.label];
    if (isSolo(mode)) {
      return {
        eyebrow: r.clearedEyebrow,
        title: r.cleared,
        stats: [
          [r.turns, r.turnsValue(summary.turns)],
          [r.time, formatTime(summary.elapsedMs)],
          [r.misses, r.missesValue(summary.turns - summary.totalPairs)],
          difficultyStat
        ]
      };
    }
    return {
      eyebrow: r.gameOverEyebrow,
      title: summary.isDraw ? r.draw : r.winnerIs(summary.winners[0].name),
      stats: [
        ...summary.players.map(p => [p.name, r.pairsValue(p.pairs)]),
        [r.turns, r.turnsValue(summary.turns)],
        difficultyStat
      ]
    };
  }
}

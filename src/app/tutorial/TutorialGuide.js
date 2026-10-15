import { EventEmitter } from '../../core/EventEmitter.js';
import { GameEvent } from '../../domain/ConcentrationGame.js';

/** チュートリアルの段階（画面に出す説明の切り替え単位） */
export const TutorialStep = Object.freeze({
  PickFirst: 'pickFirst',     // 1枚目をめくってみる
  PickSecond: 'pickSecond',   // 2枚目をめくってみる
  Matched: 'matched',         // はじめてペアを取った
  Missed: 'missed',           // はじめて外した
  KeepGoing: 'keepGoing',     // 残りもそろえる
  Done: 'done'                // 全部そろえた
});

/** 段階ごとの「何番目か」（ペアとはずれは同じ番目。どちらが先に来るかは遊ぶ人しだい） */
const STEP_ORDER = Object.freeze({
  [TutorialStep.PickFirst]: 1,
  [TutorialStep.PickSecond]: 2,
  [TutorialStep.Matched]: 3,
  [TutorialStep.Missed]: 3,
  [TutorialStep.KeepGoing]: 4,
  [TutorialStep.Done]: 5
});
export const TUTORIAL_STEP_COUNT = 5;

/** @returns {number} 1 から TUTORIAL_STEP_COUNT まで */
export function tutorialStepNumber(step) {
  const n = STEP_ORDER[step];
  if (!n) throw new Error(`未知のチュートリアルの段階です: ${step}`);
  return n;
}

export const TutorialGuideEvent = Object.freeze({ StepChanged: 'stepChanged' });

/**
 * チュートリアルの進み方。ルール（ConcentrationGame）のイベントを見て、いまどの説明を出すかを決める。
 * DOM も three.js も知らない（表示は TutorialScreen、進行は LocalGameSession に任せる）。
 */
export class TutorialGuide extends EventEmitter {
  #step = null;
  #unsubscribe = [];
  #seen = new Set();

  get step() { return this.#step; }

  /** @param {import('../../domain/ConcentrationGame.js').ConcentrationGame} game 始まる前のゲーム */
  attach(game) {
    this.detach();
    this.#seen.clear();
    this.#unsubscribe = [
      game.on(GameEvent.CardRevealed, ({ slot }) => this.#onRevealed(slot)),
      game.on(GameEvent.PairMatched, () => this.#onResolved(TutorialStep.Matched)),
      game.on(GameEvent.PairMissed, () => this.#onResolved(TutorialStep.Missed)),
      game.on(GameEvent.GameOver, () => this.#go(TutorialStep.Done))
    ];
    this.#go(TutorialStep.PickFirst);
  }

  detach() {
    this.#unsubscribe.forEach(off => off());
    this.#unsubscribe = [];
    this.#step = null;
  }

  #onRevealed(slot) {
    if (slot !== 0) return;
    this.#go(this.#step === TutorialStep.PickFirst ? TutorialStep.PickSecond : TutorialStep.KeepGoing);
  }

  /** ペア・はずれの説明は、それぞれ最初の1回だけ出す */
  #onResolved(step) {
    if (this.#seen.has(step)) return;
    this.#seen.add(step);
    this.#go(step);
  }

  #go(step) {
    if (this.#step === step) return;
    this.#step = step;
    this.emit(TutorialGuideEvent.StepChanged, step);
  }
}

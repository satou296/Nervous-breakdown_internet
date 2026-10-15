// チュートリアルの進み方と山札の単体テスト（ブラウザ不要）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/domain/Player.js';
import { SameRankRule } from '../src/domain/MatchRule.js';
import { GameStats } from '../src/domain/GameStats.js';
import { DeckFactory } from '../src/domain/DeckFactory.js';
import { ConcentrationGame } from '../src/domain/ConcentrationGame.js';
import { getGameMode } from '../src/domain/GameModes.js';
import { TEXT } from '../src/config/strings.js';
import {
  TutorialGuide, TutorialGuideEvent, TutorialStep, TUTORIAL_STEP_COUNT, tutorialStepNumber
} from '../src/app/tutorial/TutorialGuide.js';

const identity = { shuffle: a => [...a] };

/** チュートリアルの札（並び: A♠, A♥, 7♦, 7♣, K♥, K♠）でゲームを作り、段階の移り変わりを記録する */
const setUp = () => {
  const cards = new DeckFactory(identity).createFrom(getGameMode('tutorial').deck);
  const game = new ConcentrationGame({
    cards, players: [new Player({ name: 'あなた' })], matchRule: new SameRankRule(), stats: new GameStats(() => 0)
  });
  const guide = new TutorialGuide();
  const steps = [];
  guide.on(TutorialGuideEvent.StepChanged, step => steps.push(step));
  guide.attach(game);
  game.start();
  const turn = (a, b) => {
    game.select(cards[a]);
    game.select(cards[b]);
    game.resolve();
    game.endResolution();
  };
  return { game, guide, steps, turn };
};

test('チュートリアルは数字の違う3ペア（エース・数札・絵札）の6枚で、シャッフルしてから番号を振る', () => {
  const deck = getGameMode('tutorial').deck;
  assert.equal(deck.length, 6);
  assert.deepEqual([...new Set(deck.map(f => f.rank))].sort((a, b) => a - b), [1, 7, 13]);
  const reversed = new DeckFactory({ shuffle: a => [...a].reverse() }).createFrom(deck);
  assert.deepEqual(reversed.map(c => c.id), [0, 1, 2, 3, 4, 5]);
  assert.equal(reversed[0].rank, 13);
  assert.throws(() => new DeckFactory(identity).createFrom([{ rank: 14, suit: 0 }]), RangeError);
});

test('めくる → 2枚目 → はずれ → 続き → ペア → 完了 の順に説明が進む', () => {
  const { steps, turn, game } = setUp();
  assert.deepEqual(steps, [TutorialStep.PickFirst]);
  turn(0, 2);                      // A と 7：はずれ
  assert.deepEqual(steps.slice(1), [TutorialStep.PickSecond, TutorialStep.Missed]);
  turn(0, 1);                      // A のペア
  assert.deepEqual(steps.slice(3), [TutorialStep.KeepGoing, TutorialStep.Matched]);
  turn(2, 3);
  turn(4, 5);
  assert.equal(game.remainingPairs, 0);
  // ペアの説明は最初の1回だけ。2回目以降は「続き」のまま
  assert.deepEqual(steps.slice(5), [TutorialStep.KeepGoing, TutorialStep.Done]);
});

test('detach すると、それ以降のゲームの出来事では進まない', () => {
  const { guide, steps, turn } = setUp();
  guide.detach();
  assert.equal(guide.step, null);
  turn(0, 1);
  assert.deepEqual(steps, [TutorialStep.PickFirst]);
});

test('どの段階にも説明文と番号がある', () => {
  for (const step of Object.values(TutorialStep)) {
    assert.ok(TEXT.tutorial.steps[step], step);
    const n = tutorialStepNumber(step);
    assert.ok(n >= 1 && n <= TUTORIAL_STEP_COUNT, step);
  }
  assert.equal(tutorialStepNumber(TutorialStep.Done), TUTORIAL_STEP_COUNT);
});

// ルール層の単体テスト（ブラウザ不要）：node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Card } from '../src/domain/Card.js';
import { Player, PlayerKind } from '../src/domain/Player.js';
import { SameRankRule } from '../src/domain/MatchRule.js';
import { GameStats } from '../src/domain/GameStats.js';
import { DeckFactory } from '../src/domain/DeckFactory.js';
import { ConcentrationGame, GameEvent, GamePhase } from '../src/domain/ConcentrationGame.js';
import { CpuMemory } from '../src/ai/CpuMemory.js';
import { MemoryCpuStrategy } from '../src/ai/MemoryCpuStrategy.js';

const identity = { shuffle: a => [...a] };
const makeGame = (players = [new Player({ name: 'A' }), new Player({ name: 'B' })]) => {
  // 並び: [1♠,1♥,1♦,1♣,2♠,2♥,2♦,2♣]
  const cards = new DeckFactory(identity).create(2);
  let now = 0;
  const game = new ConcentrationGame({ cards, players, matchRule: new SameRankRule(), stats: new GameStats(() => (now += 1000)) });
  return { game, cards, players };
};

test('山札は 4スート × ランク数 の枚数になる', () => {
  assert.equal(new DeckFactory(identity).create(13).length, 52);
  assert.equal(new DeckFactory(identity).create(5).length, 20);
});

test('同じ数字ならペア獲得し、同じプレイヤーが続ける', () => {
  const { game, cards, players } = makeGame();
  const turns = [];
  game.on(GameEvent.TurnStarted, e => turns.push(e));
  game.start();
  game.select(cards[0]); game.select(cards[1]);
  assert.equal(game.phase, GamePhase.Resolving);
  assert.equal(game.resolve().matched, true);
  game.endResolution();
  assert.equal(players[0].pairs, 1);
  assert.equal(game.currentPlayer, players[0]);
  assert.equal(turns.at(-1).continued, true);
  assert.equal(game.remainingPairs, 3);
});

test('違う数字なら裏に戻り、次のプレイヤーへ', () => {
  const { game, cards, players } = makeGame();
  game.start();
  game.select(cards[0]); game.select(cards[4]);
  assert.equal(game.resolve().matched, false);
  assert.equal(cards[0].isSelectable, false, '判定直後はまだ表のまま');
  game.endResolution();
  assert.equal(cards[0].isSelectable, true);
  assert.equal(cards[4].isSelectable, true);
  assert.equal(game.currentPlayer, players[1]);
});

test('判定中は3枚目を選べない・同じカードは2回選べない', () => {
  const { game, cards } = makeGame();
  game.start();
  assert.equal(game.select(cards[0]), true);
  assert.equal(game.select(cards[0]), false);
  game.select(cards[4]);
  assert.equal(game.select(cards[5]), false);
});

test('すべて取ると終了し、勝者が決まる', () => {
  const { game, cards, players } = makeGame();
  let summary = null;
  game.on(GameEvent.GameOver, s => { summary = s; });
  game.start();
  for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7]]) {
    game.select(cards[a]); game.select(cards[b]); game.resolve(); game.endResolution();
  }
  assert.equal(game.phase, GamePhase.Finished);
  assert.equal(summary.winners[0], players[0]);
  assert.equal(summary.isDraw, false);
  assert.equal(summary.turns, 4);
});

test('CPU は覚えているペアを優先して取る', () => {
  const cards = new DeckFactory(identity).create(2);
  const memory = new CpuMemory({ rememberChance: 1 });
  memory.observe(cards[4]); memory.observe(cards[6]);
  const strategy = new MemoryCpuStrategy({ memory, matchRule: new SameRankRule(), random: () => 0 });
  const first = strategy.chooseFirst(cards);
  assert.equal(first, cards[4]);
  assert.equal(strategy.chooseSecond(first, cards), cards[6]);
});

test('Card は不正な状態遷移を拒否する', () => {
  const c = new Card(0, 1, 0);
  c.turnUp();
  assert.throws(() => c.turnUp());
  assert.equal(new Player({ name: 'x', kind: PlayerKind.Cpu }).isCpu, true);
});

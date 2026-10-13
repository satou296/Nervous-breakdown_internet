import { EventEmitter } from '../../src/core/EventEmitter.js';
import { ConcentrationGame, GameEvent, GamePhase } from '../../src/domain/ConcentrationGame.js';
import { GameStats } from '../../src/domain/GameStats.js';
import { Player } from '../../src/domain/Player.js';
import { CardState } from '../../src/domain/Card.js';
import { ServerMessage, ErrorCode } from '../../src/net/Protocol.js';
import { randomSeed } from '../../src/core/random.js';

export const MatchEvent = Object.freeze({
  Outbound: 'outbound', // { type, payload } … 部屋の全員へ送る
  Finished: 'finished'
});

export class MatchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * サーバー上の1試合。ルール（ConcentrationGame。画面側と同じコード）を持ち、判定はすべてここで行う。
 * 画面へ送るのは「めくられたカードの中身」「判定結果」「手番」などの必要な分だけ。
 * 手番の持ち時間切れ・手番の人の切断では、自動で次の人へ回す。
 */
export class OnlineMatch extends EventEmitter {
  #game;
  #owners = new Map();      // cardId → 取った人の番号
  #connected;
  #cancelTurnTimer = () => {};
  #turnEndsAt = null;

  constructor({
    playerNames, difficultyId, deckSize, deckFactory, deckOptions, matchRule, timing,
    scheduler, turnTimeoutMs, disconnectGraceMs, now = () => Date.now(), seed = randomSeed()
  }) {
    super();
    Object.assign(this, { difficultyId, deckSize, timing, scheduler, turnTimeoutMs, disconnectGraceMs, now, seed });
    this.#game = new ConcentrationGame({
      cards: deckFactory.create(deckOptions[deckSize]),
      players: playerNames.map(name => new Player({ name })),
      matchRule,
      stats: new GameStats(now)
    });
    this.#connected = playerNames.map(() => true);
    this.#subscribe();
  }

  /** 試合の時刻の基準（画面側のカードの動きをこの時刻にそろえる） */
  epoch = null;

  get currentPlayerIndex() { return this.#game.currentPlayerIndex; }

  start() {
    this.epoch = this.now();
    this.scheduler.after(this.timing.dealSettleMs, () => this.#game.start());
  }

  /** 途中参加・再接続した人にも同じ内容を送れる、試合開始の情報 */
  startInfoFor(youIndex) {
    return {
      seed: this.seed,
      deck: this.#game.cards.map(c => c.id),
      players: this.#game.players.map(p => p.name),
      youIndex,
      difficultyId: this.difficultyId,
      deckSize: this.deckSize,
      epoch: this.epoch,
      serverNow: this.now(),
      started: this.#game.phase !== GamePhase.Waiting,
      state: this.#state(),
      turnEndsAt: this.#turnEndsAt,
      snapshot: this.#snapshot()
    };
  }

  /** @throws {MatchError} 自分の手番でない・選べないカード */
  select(playerIndex, cardId) {
    if (playerIndex !== this.#game.currentPlayerIndex) throw new MatchError(ErrorCode.NotYourTurn, 'あなたの番ではありません');
    const card = this.#game.cardById(cardId);
    if (!card || !this.#game.select(card)) throw new MatchError(ErrorCode.InvalidMessage, 'そのカードは選べません');
  }

  isCurrent(playerIndex) {
    return this.#game.phase === GamePhase.Selecting && this.#game.currentPlayerIndex === playerIndex;
  }

  /** 接続が切れた／戻った。手番の人が切れていたら、少し待って次の人へ回す */
  setConnected(playerIndex, connected) {
    this.#connected[playerIndex] = connected;
    if (playerIndex === this.#game.currentPlayerIndex && this.#game.phase === GamePhase.Selecting) this.#armTurnTimer();
  }

  dispose() {
    this.scheduler.cancelAll();
    this.#game.removeAllListeners();
    this.removeAllListeners();
  }

  /* ---------------- ルールのイベント → 送信と時間進行 ---------------- */

  #subscribe() {
    const g = this.#game;
    g.on(GameEvent.CardRevealed, ({ card, slot }) => this.#send(ServerMessage.CardRevealed, {
      cardId: card.id, rank: card.rank, suit: card.suit, slot, playerIndex: g.currentPlayerIndex
    }));
    g.on(GameEvent.SelectionComplete, () => {
      this.#cancelTurnTimer();
      this.scheduler.after(this.timing.resolveDelayMs, () => g.resolve());
    });
    g.on(GameEvent.PairMatched, ({ cards }) => this.#onResolved(true, cards, this.timing.matchCollectDelayMs));
    g.on(GameEvent.PairMissed, ({ cards }) => this.#onResolved(false, cards, this.timing.missHideDelayMs));
    g.on(GameEvent.SelectionCancelled, ({ cards }) => this.#send(ServerMessage.SelectionCancelled, { cardIds: cards.map(c => c.id) }));
    g.on(GameEvent.TurnStarted, ({ continued, passed = false }) => {
      this.#armTurnTimer();
      this.#send(ServerMessage.TurnStarted, {
        playerIndex: g.currentPlayerIndex, continued, passed, state: this.#state(), turnEndsAt: this.#turnEndsAt
      });
    });
    g.on(GameEvent.GameOver, summary => {
      this.#cancelTurnTimer();
      this.scheduler.after(this.timing.gameOverDelayMs, () => {
        this.#send(ServerMessage.MatchOver, { summary: this.#publicSummary(summary) });
        this.emit(MatchEvent.Finished);
      });
    });
  }

  #onResolved(matched, cards, delayMs) {
    const g = this.#game;
    const playerIndex = g.currentPlayerIndex;
    const cardIds = cards.map(c => c.id);
    if (matched) cardIds.forEach(id => this.#owners.set(id, playerIndex));
    this.#send(ServerMessage.PairResolved, { matched, playerIndex, cardIds });
    this.scheduler.after(delayMs, () => {
      this.#send(ServerMessage.PairSettled, { matched, playerIndex, cardIds, state: this.#state() });
      g.endResolution();
    });
  }

  /** 手番の持ち時間（切断中なら短い猶予）を測り直す */
  #armTurnTimer() {
    this.#cancelTurnTimer();
    const index = this.#game.currentPlayerIndex;
    const wait = this.#connected[index] ? this.turnTimeoutMs : this.disconnectGraceMs;
    this.#turnEndsAt = this.now() + wait;
    this.#cancelTurnTimer = this.scheduler.after(wait, () => {
      if (this.#game.currentPlayerIndex === index) this.#game.passTurn();
    });
  }

  #state() {
    const g = this.#game;
    return {
      scores: g.players.map(p => p.pairs),
      currentIndex: g.currentPlayerIndex,
      remainingPairs: g.remainingPairs,
      turns: g.stats.turns
    };
  }

  /** 再接続した人が、場の状態を取り戻すための情報（表になっているカードだけ中身を含める） */
  #snapshot() {
    const g = this.#game;
    const face = c => ({ cardId: c.id, rank: c.rank, suit: c.suit });
    return {
      matched: g.cards.filter(c => c.state === CardState.Matched).map(c => ({ ...face(c), owner: this.#owners.get(c.id) })),
      selection: g.selection.map((c, slot) => ({ ...face(c), slot }))
    };
  }

  #publicSummary(summary) {
    const players = summary.players;
    return {
      players: players.map(p => ({ name: p.name, pairs: p.pairs })),
      winners: summary.winners.map(w => players.indexOf(w)),
      isDraw: summary.isDraw,
      turns: summary.turns,
      totalPairs: summary.totalPairs
    };
  }

  #send(type, payload) {
    this.emit(MatchEvent.Outbound, { type, payload });
  }
}

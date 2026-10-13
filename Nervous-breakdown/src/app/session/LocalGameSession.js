import { EventEmitter } from '../../core/EventEmitter.js';
import { Scheduler } from '../../core/Scheduler.js';
import { ConcentrationGame, GameEvent, GamePhase } from '../../domain/ConcentrationGame.js';
import { GameStats } from '../../domain/GameStats.js';
import { createPlayers } from '../../domain/GameModes.js';
import { CpuMemory } from '../../ai/CpuMemory.js';
import { MemoryCpuStrategy } from '../../ai/MemoryCpuStrategy.js';
import { CpuTurnRunner } from '../../ai/CpuTurnRunner.js';
import { GamePresenter } from './GamePresenter.js';
import { SessionEvent } from './SessionEvent.js';

/**
 * 1台で遊ぶゲーム（ひとり・CPU対戦・2人交代）の進行。GameSession インターフェースを実装。
 * ルール（ConcentrationGame）が手元にあり、そのイベントを受けて、
 * 見せ方（GamePresenter）と CPU の手番を適切なタイミングでつなぐ。
 *
 * 時間はすべてゲーム内時計（services.clock）で数えるので、ポーズ中は
 * タイマー・判定待ち・CPU の思考がまとめて止まる。Updatable（PausableTimeline の中で動かす）。
 */
export class LocalGameSession extends EventEmitter {
  freezesTime = true;
  #scheduler;
  #game;
  #presenter;
  #cpuMemory = null;
  #cpuRunner = null;
  #inputLocked = true;
  #revealInProgress = false;
  #selection;

  constructor({ mode, difficulty, deckSize, services }) {
    super();
    this.mode = mode;
    this.difficulty = difficulty;
    this.deckSize = deckSize;
    this.s = services;
    this.#scheduler = new Scheduler(services.clock);
    this.#selection = services.selectionFactory.create(difficulty.interaction);
    this.#presenter = new GamePresenter({ mode, difficulty, usesReach: this.usesReach, services });
  }

  get game() { return this.#game; }

  /** このゲームは腕を伸ばしてカードに触れる操作を使うか */
  get usesReach() { return this.#selection.usesReach; }

  /** 手のひらが触れたカードをその場に止めるか（極では止めない） */
  get holdsTouchedCard() { return this.difficulty.holdOnTouch ?? true; }

  /** カーソルを合わせたカードを光らせるか（腕で触れる遊び方では光らせない） */
  get usesHover() { return this.#selection.usesHover; }

  start() {
    const { deckFactory, deckOptions, matchRule, timing } = this.s;
    const maxRank = deckOptions[this.deckSize];
    if (!maxRank) throw new Error(`選べない枚数です: ${this.deckSize}`);

    this.#game = new ConcentrationGame({
      cards: deckFactory.create(maxRank),
      players: createPlayers(this.mode),
      matchRule,
      stats: new GameStats(() => this.s.clock.nowMs)
    });
    this.#setUpCpu();
    this.#subscribe();
    this.#presenter.setUp(this.#game.cards);
    this.#renderHud();
    this.#scheduler.after(timing.dealSettleMs, () => {
      this.#inputLocked = false;
      this.#game.start();
    });
  }

  /** 人間のプレイヤーがいまカードを選べるか */
  canHumanAct() {
    return !this.#inputLocked
      && !this.#revealInProgress
      && this.#game?.phase === GamePhase.Selecting
      && !this.#game.currentPlayer.isCpu;
  }

  /** 1台で遊ぶときは、いつでも腕を伸ばせる */
  allowsReach() {
    return this.usesReach;
  }

  /** 人間が画面上のある位置をタップした */
  handleTap(ndc) {
    if (!this.canHumanAct()) return;
    const card = this.#selection.cardFromTap(ndc);
    if (card) this.#game.select(card);
  }

  /** 1台で遊ぶときは、弾いたことを誰かに伝える必要はない */
  reportKnock() {}

  update() {
    this.#scheduler.update();
    this.#presenter.updateClock(this.#game.stats.elapsedMs);
  }

  dispose() {
    this.#scheduler.cancelAll();
    this.#game?.removeAllListeners();
    this.#presenter.tearDown();
  }

  /* ---------------- 準備 ---------------- */

  #setUpCpu() {
    if (!this.#game.players.some(p => p.isCpu)) return;
    const { cpuConfig, matchRule, timing } = this.s;
    this.#cpuMemory = new CpuMemory({ rememberChance: cpuConfig.rememberChance });
    this.#cpuRunner = new CpuTurnRunner({
      strategy: new MemoryCpuStrategy({ memory: this.#cpuMemory, matchRule }),
      scheduler: this.#scheduler,
      timing,
      aim: (card, done) => this.#aimAt(card, done),
      select: card => this.#game.select(card)
    });
  }

  #subscribe() {
    const g = this.#game;
    g.on(GameEvent.CardRevealed, e => this.#onCardRevealed(e));
    g.on(GameEvent.SelectionComplete, () => this.#onSelectionComplete());
    g.on(GameEvent.PairMatched, e => this.#onPairMatched(e));
    g.on(GameEvent.PairMissed, e => this.#onPairMissed(e));
    g.on(GameEvent.TurnStarted, e => this.#onTurnStarted(e));
    g.on(GameEvent.GameOver, e => this.#onGameOver(e));
  }

  /* ---------------- ルールのイベント → 演出 ---------------- */

  #onCardRevealed({ card, slot }) {
    this.#presenter.reveal(card, slot);
    this.#cpuMemory?.observe(card);
    // 大きく表示している間は次のカードを選ばせない（重なって見えなくなるのを防ぐ）
    this.#revealInProgress = true;
    this.#scheduler.after(this.#presenter.revealDurationMs, () => { this.#revealInProgress = false; });
  }

  #onSelectionComplete() {
    this.#renderHud();
    this.#scheduler.after(this.s.timing.resolveDelayMs, () => this.#game.resolve());
  }

  #onPairMatched({ player, cards }) {
    this.#presenter.announceMatch(player.name);
    cards.forEach(c => this.#cpuMemory?.forget(c));
    this.#scheduler.after(this.s.timing.matchCollectDelayMs, () => {
      this.#presenter.collect(cards, this.#game.currentPlayerIndex);
      this.#renderHud();
      this.#game.endResolution();
    });
  }

  #onPairMissed({ cards }) {
    this.#presenter.announceMiss();
    this.#scheduler.after(this.s.timing.missHideDelayMs, () => {
      this.#presenter.returnToAir(cards);
      this.#game.endResolution();
    });
  }

  #onTurnStarted({ player, continued }) {
    this.#renderHud();
    this.#presenter.announceTurn(player.name, continued);
    if (player.isCpu) this.#cpuRunner?.play(this.#game);
  }

  #onGameOver(summary) {
    this.#renderHud();
    this.#scheduler.after(this.s.timing.gameOverDelayMs, () => this.emit(SessionEvent.Finished, summary));
  }

  /* ---------------- 補助 ---------------- */

  /** CPU が狙っているカードを少し光らせてから選ぶ */
  #aimAt(card, done) {
    const view = this.#presenter.viewOf(card);
    view.setAimed(true);
    this.#scheduler.after(this.s.timing.cpuAimMs, () => {
      view.setAimed(false);
      done();
    });
  }

  #renderHud() {
    const g = this.#game;
    this.#presenter.renderHud({
      players: g.players.map(p => ({ name: p.name, pairs: p.pairs })),
      currentIndex: g.currentPlayerIndex,
      remainingPairs: g.remainingPairs,
      turns: g.stats.turns
    });
  }
}

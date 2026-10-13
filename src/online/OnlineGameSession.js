import { EventEmitter } from '../core/EventEmitter.js';
import { Scheduler } from '../core/Scheduler.js';
import { ClientMessage, ServerMessage } from '../net/Protocol.js';
import { getDifficulty } from '../config/Difficulties.js';
import { TEXT } from '../config/strings.js';
import { GamePresenter } from '../app/session/GamePresenter.js';
import { SessionEvent } from '../app/session/SessionEvent.js';
import { RemoteCard } from './RemoteCard.js';
import { createOnlineMode } from './onlineMode.js';

const SELECT_REPLY_TIMEOUT_MS = 3000;
const CLOCK_RESYNC_MS = 150;

/**
 * オンライン対戦の1試合。GameSession インターフェースを実装。
 * ルールの判定はサーバーにあり、ここは「サーバーからの知らせ」を見せ方（GamePresenter）に伝え、
 * 自分の操作（カードを選ぶ・狙い・弾き）をサーバーへ送るだけ。
 *
 * カードの浮遊は「同じ種」と「サーバーにそろえた時計」で全員の画面で同じ動きになる。
 * オンラインでは時間を止められないので freezesTime = false。
 */
export class OnlineGameSession extends EventEmitter {
  freezesTime = false;
  #scheduler;
  #presenter;
  #selection;
  #cards;
  #names;
  #unsubscribers = [];
  #state;
  #phase = 'dealing';           // dealing → selecting ⇄ resolving
  #picks = 0;
  #awaitingServer = false;
  #revealInProgress = false;
  #sinceClockCheck = 0;
  #startInfo;

  /**
   * @param {object} p
   * @param {object} p.start   サーバーの match_started の中身
   * @param {object} p.services  画面側の共通部品（LocalGameSession と同じ）
   * @param {object} p.online    { network, serverClock, remotePlayers, presence }
   */
  constructor({ start, services, online }) {
    super();
    this.#startInfo = start;
    this.s = services;
    this.o = online;
    this.youIndex = start.youIndex;
    this.difficulty = getDifficulty(start.difficultyId);
    this.mode = createOnlineMode(start.players, start.youIndex);
    this.#names = this.mode.seats.map(seat => seat.name);
    this.#scheduler = new Scheduler(services.clock);
    this.#selection = services.selectionFactory.create(this.difficulty.interaction);
    this.#presenter = new GamePresenter({ mode: this.mode, difficulty: this.difficulty, usesReach: this.usesReach, services });
    this.#state = start.state;
  }

  get usesReach() { return this.#selection.usesReach; }
  get usesHover() { return this.#selection.usesHover; }
  get holdsTouchedCard() { return this.difficulty.holdOnTouch ?? true; }
  get isMyTurn() { return this.#state.currentIndex === this.youIndex; }

  start() {
    const start = this.#startInfo;
    this.#syncClock(true);
    this.#cards = start.deck.map(id => new RemoteCard(id));
    this.#presenter.setUp(this.#cards, { seed: start.seed });
    this.#subscribe();
    this.#applySnapshot(start.snapshot);
    this.#renderHud();
    if (start.started) {
      this.#phase = start.snapshot.selection.length >= 2 ? 'resolving' : 'selecting';
    } else {
      this.#scheduler.after(this.s.timing.dealSettleMs, () => { if (this.#phase === 'dealing') this.#phase = 'selecting'; });
    }
  }

  canHumanAct() {
    return this.#phase === 'selecting'
      && this.isMyTurn
      && !this.#awaitingServer
      && !this.#revealInProgress
      && this.#picks < 2;
  }

  /** 腕を伸ばせるのは自分の手番のときだけ（他の人のカードを散らかせないように） */
  allowsReach() {
    return this.usesReach && this.isMyTurn && this.#phase !== 'dealing';
  }

  handleTap(ndc) {
    if (!this.canHumanAct()) return;
    const card = this.#selection.cardFromTap(ndc);
    if (!card || card.isKnown) return;
    this.#awaitingServer = true;
    this.o.network.send(ClientMessage.SelectCard, { cardId: card.id });
    // 返事が来なければ、もう一度選べるように戻す
    this.#scheduler.after(SELECT_REPLY_TIMEOUT_MS, () => { this.#awaitingServer = false; });
  }

  reportKnock(view, impulse, spin) {
    if (!this.isMyTurn) return;
    const round = n => Math.round(n * 1000) / 1000;
    this.o.network.send(ClientMessage.Knock, {
      cardId: view.card.id,
      impulse: [round(impulse.x), round(impulse.y), round(impulse.z)],
      spin: round(spin)
    });
  }

  update(dt) {
    this.#scheduler.update();
    this.o.presence.tick(dt);
    this.#sinceClockCheck += dt;
    if (this.#sinceClockCheck > 2) {
      this.#sinceClockCheck = 0;
      this.#syncClock(false);
    }
  }

  dispose() {
    this.#scheduler.cancelAll();
    this.#unsubscribers.forEach(off => off());
    this.#unsubscribers = [];
    this.o.remotePlayers.clear();
    this.#presenter.tearDown();
  }

  /* ---------------- サーバーからの知らせ ---------------- */

  #subscribe() {
    const on = (type, handler) => this.#unsubscribers.push(this.o.network.on(type, handler));
    on(ServerMessage.CardRevealed, p => this.#onCardRevealed(p));
    on(ServerMessage.PairResolved, p => this.#onPairResolved(p));
    on(ServerMessage.PairSettled, p => this.#onPairSettled(p));
    on(ServerMessage.SelectionCancelled, p => this.#onSelectionCancelled(p));
    on(ServerMessage.TurnStarted, p => this.#onTurnStarted(p));
    on(ServerMessage.MatchOver, p => this.#onMatchOver(p));
    on(ServerMessage.Presence, p => this.#onPresence(p));
    on(ServerMessage.Knock, p => this.#onKnock(p));
    on(ServerMessage.PlayerStatus, p => this.#onPlayerStatus(p));
    on(ServerMessage.Error, () => { this.#awaitingServer = false; });
  }

  #onCardRevealed({ cardId, rank, suit, slot }) {
    const card = this.#presenter.cardById(cardId);
    if (!card) return;
    card.reveal(rank, suit);
    this.#awaitingServer = false;
    this.#picks = slot + 1;
    if (this.#picks >= 2) this.#phase = 'resolving';
    this.#presenter.reveal(card, slot);
    this.#revealInProgress = true;
    this.#scheduler.after(this.#presenter.revealDurationMs, () => { this.#revealInProgress = false; });
  }

  #onPairResolved({ matched, playerIndex }) {
    if (matched) this.#presenter.announceMatch(this.#names[playerIndex]);
    else this.#presenter.announceMiss();
  }

  #onPairSettled({ matched, playerIndex, cardIds, state }) {
    const cards = cardIds.map(id => this.#presenter.cardById(id)).filter(Boolean);
    if (matched) this.#presenter.collect(cards, playerIndex);
    else this.#presenter.returnToAir(cards);
    this.#state = state;
    this.#renderHud();
  }

  #onSelectionCancelled({ cardIds }) {
    const cards = cardIds.map(id => this.#presenter.cardById(id)).filter(Boolean);
    this.#presenter.returnToAir(cards);
  }

  #onTurnStarted({ playerIndex, continued, passed, state }) {
    this.#state = state;
    this.#phase = 'selecting';
    this.#picks = 0;
    this.#awaitingServer = false;
    this.o.remotePlayers.setActive(playerIndex);
    this.#renderHud();
    if (passed) this.#presenter.announce(TEXT.online.turnPassed, 'bad');
    else this.#presenter.announceTurn(this.#names[playerIndex], continued);
  }

  #onMatchOver({ summary }) {
    const players = summary.players.map((p, i) => ({ name: this.#names[i], pairs: p.pairs }));
    this.emit(SessionEvent.Finished, {
      players,
      winners: summary.winners.map(i => players[i]),
      isDraw: summary.isDraw,
      turns: summary.turns,
      elapsedMs: 0,
      totalPairs: summary.totalPairs
    });
  }

  #onPresence({ playerIndex, dir, reach }) {
    if (playerIndex === this.youIndex) return;
    this.o.remotePlayers.setPose(playerIndex, this.#names[playerIndex], dir, reach, playerIndex === this.#state.currentIndex);
  }

  /** 手番の人が腕で弾いたカードを、自分の画面でも同じように弾く */
  #onKnock({ playerIndex, cardId, impulse, spin }) {
    if (playerIndex === this.youIndex) return;
    const card = this.#presenter.cardById(cardId);
    if (!card) return;
    this.#presenter.viewOf(card).knock({ x: impulse[0], y: impulse[1], z: impulse[2] }, spin);
  }

  #onPlayerStatus({ index, name, connected }) {
    if (index === this.youIndex) return;
    this.#presenter.announce(connected ? TEXT.online.playerBack(name) : TEXT.online.playerLost(name), connected ? 'good' : 'bad');
    if (!connected) this.o.remotePlayers.remove(index);
  }

  /* ---------------- 補助 ---------------- */

  /** 再接続したとき：取られたカードは置き場へ、めくりかけのカードは表に */
  #applySnapshot(snapshot) {
    for (const m of snapshot.matched) {
      const card = this.#presenter.cardById(m.cardId);
      card.reveal(m.rank, m.suit);
      this.#presenter.viewOf(card).showFaceOnBothSides();
      this.#presenter.collect([card], m.owner);
    }
    for (const s of snapshot.selection) {
      const card = this.#presenter.cardById(s.cardId);
      card.reveal(s.rank, s.suit);
      this.#presenter.reveal(card, s.slot);
      this.#picks = s.slot + 1;
    }
  }

  /** カードの動きの時計を、サーバーの時計にそろえる（ずれが大きいときだけ） */
  #syncClock(force) {
    const { serverClock } = this.o;
    const serverNow = serverClock.hasSample ? serverClock.now() : this.#startInfo.serverNow;
    const target = Math.max(0, serverNow - this.#startInfo.epoch);
    if (force || Math.abs(this.s.clock.nowMs - target) > CLOCK_RESYNC_MS) this.s.clock.setNowMs(target);
  }

  #renderHud() {
    const { scores, currentIndex, remainingPairs, turns } = this.#state;
    this.#presenter.renderHud({
      players: this.#names.map((name, i) => ({ name, pairs: scores[i] ?? 0 })),
      currentIndex,
      remainingPairs,
      turns
    });
  }
}

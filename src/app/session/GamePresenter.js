import { TEXT } from '../../config/strings.js';
import { isSolo } from '../../domain/GameModes.js';

/**
 * ゲーム中の見せ方を一か所にまとめたもの。
 * 「カードをめくって見せる」「ペアを取った人の所へ運ぶ」「裏に戻す」「HUD・お知らせ」を担う。
 * ルールの判定は持たないので、1人で遊ぶ版（ルールが手元）でも、
 * オンライン版（ルールがサーバー）でも、同じ見せ方を使える。
 */
export class GamePresenter {
  #piles = [];
  #cardsById = new Map();

  constructor({ mode, difficulty, usesReach, services }) {
    this.mode = mode;
    this.difficulty = difficulty;
    this.usesReach = usesReach;
    this.s = services;
  }

  /** カードを配り、HUD を出す。seed を同じにすると全員の画面で同じ配置・動きになる */
  setUp(cards, { seed } = {}) {
    const { field, pileFactory, hud, reachMeter } = this.s;
    this.#cardsById = new Map(cards.map(c => [c.id, c]));
    // pileSlot は置き場の並び順（オンラインでは自分以外の人を左から順に並べる）
    this.#piles = this.mode.seats.map((seat, i) => pileFactory.create(seat.pile, seat.pileSlot ?? i));
    field.populate(cards, this.difficulty, seed === undefined ? {} : { seed });
    hud.setHelp(this.usesReach ? TEXT.help.reach : TEXT.help.point);
    hud.show();
    if (this.usesReach) reachMeter.show();
  }

  cardById(id) {
    return this.#cardsById.get(id) ?? null;
  }

  viewOf(card) {
    return this.s.field.viewOf(card);
  }

  /** めくったカードを中央に大きく見せてから、画面下部の slot 番目へ */
  reveal(card, slot) {
    this.s.choreographer.reveal(this.viewOf(card), slot);
  }

  /** 表示しきるまでの時間（この間は次のカードを選ばせない） */
  get revealDurationMs() {
    return this.s.choreographer.revealDurationMs;
  }

  announceMatch(playerName) {
    this.s.toast.show(isSolo(this.mode) ? TEXT.pair : TEXT.pairBy(playerName), 'good');
  }

  announceMiss() {
    this.s.toast.show(TEXT.miss, 'bad');
  }

  announceTurn(playerName, continued) {
    if (this.mode.announceTurns && !continued) this.s.toast.show(TEXT.turnOf(playerName));
  }

  announce(message, tone) {
    this.s.toast.show(message, tone);
  }

  /** 取ったプレイヤーの置き場へ運ぶ */
  collect(cards, playerIndex) {
    const pile = this.#piles[playerIndex];
    cards.forEach(c => this.s.choreographer.collect(this.viewOf(c), pile.nextSlot()));
  }

  /** 両面を裏に戻して、ふたたび宙を漂わせる */
  returnToAir(cards) {
    cards.forEach(c => this.s.choreographer.returnToAir(this.viewOf(c)));
  }

  /**
   * @param {{ players: {name:string, pairs:number}[], currentIndex: number,
   *           remainingPairs: number, turns: number }} state
   */
  renderHud({ players, currentIndex, remainingPairs, turns }) {
    const solo = isSolo(this.mode);
    this.s.hud.render({
      turnLabel: solo ? TEXT.pickPrompt : TEXT.turnOf(players[currentIndex].name),
      remainingPairs,
      turnCount: this.mode.showTurnCount ? turns : null,
      players,
      activeIndex: solo ? null : currentIndex,
      showClock: this.mode.showClock
    });
  }

  updateClock(ms) {
    if (this.mode.showClock) this.s.hud.updateClock(ms);
  }

  tearDown() {
    this.s.field.clear();
    this.s.hud.hide();
    this.s.reachMeter.hide();
  }
}

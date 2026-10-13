import { MenuEvent } from '../ui/MenuScreen.js';
import { ResultEvent } from '../ui/ResultScreen.js';
import { PauseScreenEvent } from '../ui/PauseScreen.js';
import { PauseButtonEvent } from '../ui/PauseButton.js';
import { SessionEvent } from './session/SessionEvent.js';
import { PointerInputEvent } from '../input/PointerInput.js';
import { KeyboardInputEvent } from '../input/KeyboardInput.js';
import { LobbyEvent } from '../online/OnlineLobby.js';

const ONLINE_MODE_ID = 'online';

/**
 * 画面遷移（メニュー → プレイ ⇄ ポーズ → 結果、オンラインでは 待合室 → プレイ → 結果 → 待合室）と、
 * 入力のプレイ中セッションへの振り分け。
 * セッションの作り方は createLocalSession / createOnlineSession に、
 * 部屋の出入りは lobby（OnlineLobby）に、ポーズは pause（PauseController）に委ねる。
 * Updatable（PausableTimeline の中で動かす）。
 */
export class App {
  #session = null;
  #lastLocalSettings = null;
  #onlineAvailable = false;

  constructor({
    menu, result, loading, pauseScreen, pauseButton, pause, pointer, keyboard, rig, pointingHand,
    attract, createLocalSession, createOnlineSession, lobby, roomLink, resultFormatter, toast, strings,
    documentRef = document
  }) {
    Object.assign(this, {
      menu, result, loading, pauseScreen, pauseButton, pause, pointer, keyboard, rig, pointingHand,
      attract, createLocalSession, createOnlineSession, lobby, roomLink, resultFormatter, toast, strings,
      documentRef
    });
  }

  /** @param {{ onlineAvailable: boolean }} p このページがオンライン対戦サーバーから配信されているか */
  boot({ onlineAvailable }) {
    this.#onlineAvailable = onlineAvailable;
    this.menu.setOnlineAvailable(onlineAvailable, this.strings.online.unavailable);
    this.#wireInput();
    this.#wireScreens();
    this.attract.show();
    this.loading.hide();
    // 招待URLで開いたときは、確認の結果を待たずに参加画面へ（つながらなければその画面でエラーを出す）
    const inviteCode = this.roomLink.currentCode();
    if (inviteCode) this.lobby.openJoin(inviteCode);
    else this.menu.show();
  }

  /** いま人間が操作できるか（ホバー・手の向き・タップで使う） */
  canHumanAct() {
    return this.isPlaying() && (this.#session?.canHumanAct() ?? false);
  }

  /** 腕を伸ばす操作を受け付けるか（達人・極のプレイ中。オンラインでは自分の手番だけ） */
  canReach() {
    return this.isPlaying() && (this.#session?.allowsReach() ?? false);
  }

  /** 手のひらが触れたカードを押さえて止めるか */
  canHoldTouched() {
    return this.canReach() && (this.#session?.holdsTouchedCard ?? false);
  }

  /** カーソルを合わせたカードを光らせるか */
  canHover() {
    return this.canHumanAct() && (this.#session?.usesHover ?? false);
  }

  /** プレイ画面が前面にあり、ポーズ（メニュー）も開いていない */
  isPlaying() {
    return this.#session !== null
      && !this.pause.isPaused
      && !this.menu.isOpen
      && !this.result.isOpen;
  }

  /** 腕でカードを弾いた（オンラインでは全員に伝える） */
  reportKnock(view, impulse, spin) {
    this.#session?.reportKnock(view, impulse, spin);
  }

  update(dt, elapsed) {
    this.#session?.update(dt, elapsed);
  }

  /* ---------------- 配線 ---------------- */

  #wireInput() {
    this.pointer.on(PointerInputEvent.Tap, ndc => {
      if (!this.isPlaying()) return;
      this.pointingHand.poke();
      this.#session.handleTap(ndc);
    });
    this.pointer.on(PointerInputEvent.Drag, ({ dx, dy }) => {
      if (this.isPlaying() || this.menu.isOpen) this.rig.lookByPixels(dx, dy);
    });
    this.keyboard.setLookEnabled(() => this.isPlaying());
    this.keyboard.setReachEnabled(() => this.canReach());
    this.keyboard.on(KeyboardInputEvent.Escape, () => this.#togglePause());
    this.pointingHand.setAimProvider(() => (this.canHumanAct() ? this.pointer.ndc : null));
    // 別のタブに切り替えたら自動でポーズ（時間を止められるゲームだけ）
    this.documentRef.addEventListener('visibilitychange', () => {
      if (this.documentRef.hidden && this.isPlaying() && this.#session.freezesTime) this.#pause();
    });
  }

  #wireScreens() {
    this.menu.on(MenuEvent.Start, settings => {
      if (settings.modeId === ONLINE_MODE_ID) this.#openLobby(settings);
      else this.#startLocal(settings);
    });
    this.result.on(ResultEvent.PlayAgain, () => {
      if (this.#isOnline()) this.#backToRoom();
      else this.#startLocal(this.#lastLocalSettings);
    });
    this.result.on(ResultEvent.BackToMenu, () => this.#quit());
    this.pauseButton.on(PauseButtonEvent.Press, () => this.#togglePause());
    this.pauseScreen.on(PauseScreenEvent.Resume, () => this.pause.resume());
    this.pauseScreen.on(PauseScreenEvent.Quit, () => this.#quit());

    this.lobby.on(LobbyEvent.MatchStarted, start => this.#runSession(this.createOnlineSession(start)));
    this.lobby.on(LobbyEvent.Exited, ({ message }) => {
      if (message) this.toast.show(message, 'bad');
      this.#openMenu();
    });
    this.lobby.on(LobbyEvent.ConnectionLost, () => this.toast.show(this.strings.online.connectionLost, 'bad'));
    this.lobby.on(LobbyEvent.ConnectionRestored, () => this.toast.show(this.strings.online.connectionRestored, 'good'));
  }

  /* ---------------- 遷移 ---------------- */

  #togglePause() {
    if (this.pause.isPaused) this.pause.resume();
    else if (this.isPlaying()) this.#pause();
  }

  #pause() {
    const freeze = this.#session?.freezesTime ?? true;
    this.pause.pause({ freeze, note: freeze ? '' : this.strings.online.pauseNote });
  }

  #startLocal(settings) {
    this.#lastLocalSettings = settings;
    try {
      this.#runSession(this.createLocalSession(settings));
    } catch (err) {
      console.error(err);
      this.toast.show(this.strings.startFailed(err.message), 'bad');
      this.#openMenu();
    }
  }

  #runSession(session) {
    this.#endSession();
    this.attract.hide();
    this.menu.hide();
    this.result.hide();
    session.on(SessionEvent.Finished, summary => this.#showResult(summary, session));
    session.on(SessionEvent.Aborted, ({ message }) => {
      this.toast.show(message, 'bad');
      this.#quit();
    });
    this.#session = session;
    this.pause.activate();
    session.start();
  }

  #openLobby(settings) {
    if (!this.#onlineAvailable) return;
    this.menu.hide();
    this.lobby.openCreate({ difficultyId: settings.difficultyId, deckSize: settings.deckSize });
  }

  /** オンライン対戦が終わったら、同じ部屋の待合室へ戻る */
  #backToRoom() {
    this.#endSession();
    this.pause.reset();
    this.result.hide();
    this.attract.show();
    this.lobby.showRoom();
  }

  /** スタート画面へ戻る（オンラインなら部屋も出る） */
  #quit() {
    if (this.lobby.inRoom) this.lobby.leave();
    this.#openMenu();
  }

  #showResult(summary, session) {
    this.pause.reset();
    this.result.show(this.resultFormatter.format(summary, session.mode, session.difficulty));
  }

  #openMenu() {
    this.#endSession();
    this.pause.reset();
    this.result.hide();
    this.attract.show();
    this.menu.show();
  }

  #isOnline() {
    return this.#session?.mode.id === ONLINE_MODE_ID || this.lobby.inRoom;
  }

  #endSession() {
    if (!this.#session) return;
    this.#session.removeAllListeners();
    this.#session.dispose();
    this.#session = null;
  }
}

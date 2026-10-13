import { EventEmitter } from '../core/EventEmitter.js';
import { escapeHtml } from './format.js';
import { TEXT } from '../config/strings.js';

export const LobbyScreenEvent = Object.freeze({
  Submit: 'submit', // { name }
  Start: 'start',
  Leave: 'leave',
  Back: 'back'
});

/**
 * オンライン対戦の待合室の画面。
 *   名前入力（部屋を作る／招待URLから参加する）と、
 *   待合室（招待URL・参加者・開始ボタン）の2つの表示を切り替える。
 * 表示と入力の通知だけを担い、通信はしない。
 */
export class LobbyScreen extends EventEmitter {
  constructor({ root, els, clipboard = globalThis.navigator?.clipboard }) {
    super();
    this.root = root;
    this.els = els;
    this.clipboard = clipboard;
    els.form.addEventListener('submit', e => {
      e.preventDefault();
      this.#submit();
    });
    els.submitBtn.addEventListener('click', () => this.#submit());
    els.backBtn.addEventListener('click', () => this.emit(LobbyScreenEvent.Back));
    els.startBtn.addEventListener('click', () => this.emit(LobbyScreenEvent.Start));
    els.leaveBtn.addEventListener('click', () => this.emit(LobbyScreenEvent.Leave));
    els.copyBtn.addEventListener('click', () => this.#copyInvite());
  }

  get isOpen() { return !this.root.hidden; }

  /** @param {{ purpose: 'create'|'join', name: string, code?: string }} p */
  showNameForm({ purpose, name, code }) {
    const L = TEXT.lobby;
    this.els.formTitle.textContent = purpose === 'create' ? L.createTitle : L.joinTitle(code);
    this.els.submitBtn.textContent = purpose === 'create' ? L.createAction : L.joinAction;
    this.els.nameInput.value = name;
    this.#setBusy(false);
    this.showError('');
    this.els.formView.hidden = false;
    this.els.roomView.hidden = true;
    this.root.hidden = false;
    this.els.nameInput.focus();
  }

  /**
   * @param {{ room: object, youIndex: number, inviteUrl: string, difficultyLabel: string }} p
   */
  showRoom({ room, youIndex, inviteUrl, difficultyLabel }) {
    const L = TEXT.lobby;
    const isHost = room.hostIndex === youIndex;
    const connectedCount = room.players.filter(p => p.connected).length;
    this.els.roomCode.textContent = room.code;
    this.els.inviteInput.value = inviteUrl;
    this.els.settings.textContent = L.settings(difficultyLabel, room.settings.deckSize);
    this.els.players.innerHTML = room.players.map(p => {
      const tags = [
        p.index === room.hostIndex ? `<span class="tag">${L.hostTag}</span>` : '',
        p.index === youIndex ? `<span class="tag you">${L.youTag}</span>` : '',
        p.connected ? '' : `<span class="tag off">${L.offlineTag}</span>`
      ].join('');
      return `<li${p.connected ? '' : ' class="offline"'}>${escapeHtml(p.name)}${tags}</li>`;
    }).join('');
    this.els.startBtn.hidden = !isHost;
    this.els.startBtn.disabled = connectedCount < room.minPlayers;
    this.els.waitNote.textContent = isHost
      ? (connectedCount < room.minPlayers ? L.needMore(room.minPlayers) : L.readyToStart)
      : L.waitForHost;
    this.showError('');
    this.els.formView.hidden = true;
    this.els.roomView.hidden = false;
    this.root.hidden = false;
  }

  showError(message) {
    this.els.error.textContent = message;
    this.els.error.hidden = !message;
    if (message) this.#setBusy(false);
  }

  hide() {
    this.root.hidden = true;
  }

  #submit() {
    const name = this.els.nameInput.value.trim();
    if (!name) {
      this.showError(TEXT.lobby.nameRequired);
      return;
    }
    this.#setBusy(true);
    this.emit(LobbyScreenEvent.Submit, { name });
  }

  #setBusy(busy) {
    this.els.submitBtn.disabled = busy;
    this.els.submitBtn.setAttribute('aria-busy', String(busy));
  }

  async #copyInvite() {
    const input = this.els.inviteInput;
    try {
      await this.clipboard.writeText(input.value);
      this.els.copyBtn.textContent = TEXT.lobby.copied;
    } catch {
      input.select(); // コピーできない環境では選択状態にして、手動でコピーしてもらう
      this.els.copyBtn.textContent = TEXT.lobby.selectToCopy;
    }
    setTimeout(() => { this.els.copyBtn.textContent = TEXT.lobby.copy; }, 1800);
  }
}

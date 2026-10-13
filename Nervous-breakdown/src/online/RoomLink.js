import { LIMITS } from '../net/Protocol.js';

/**
 * 招待URLの読み書き。
 * 送る招待URLは覚えやすい https://サイト/room/K7RQ2 の形。
 * サーバーがそれを https://サイト/?room=K7RQ2 へ転送するので、画面側はこちらを読む。
 */
export class RoomLink {
  constructor({ location = globalThis.location, history = globalThis.history } = {}) {
    this.location = location;
    this.history = history;
  }

  /** いま開いているURLに部屋番号があれば返す */
  currentCode() {
    const raw = new URLSearchParams(this.location.search).get('room')
      ?? this.location.pathname.match(/\/room\/([A-Za-z0-9]+)\/?$/)?.[1];
    if (!raw) return null;
    const code = raw.toUpperCase();
    return code.length === LIMITS.roomCodeLength ? code : null;
  }

  inviteUrl(code) {
    return `${this.location.origin}/room/${code}`;
  }

  /** アドレス欄を招待URLに変える（再読み込みしても同じ部屋に戻れるように） */
  showRoom(code) {
    try { this.history.replaceState(null, '', `${this.location.pathname}?room=${code}`); } catch { /* 表示だけなので失敗しても続ける */ }
  }

  showHome() {
    try { this.history.replaceState(null, '', this.location.pathname); } catch { /* 同上 */ }
  }
}

/**
 * WebSocket の接続元（Origin）を確かめる。
 * 他のサイトに埋め込まれた悪意のあるページから、勝手に接続されるのを防ぐ。
 * 許可リストが空なら「このサーバー自身のページから」の接続だけを許す。
 */
export class OriginPolicy {
  constructor({ allowedOrigins = [] }) {
    this.allowed = new Set(allowedOrigins.map(o => o.replace(/\/$/, '')));
  }

  isAllowed(origin, host) {
    if (!origin) return false;
    if (this.allowed.size > 0) return this.allowed.has(origin.replace(/\/$/, ''));
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
}

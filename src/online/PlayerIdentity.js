/**
 * 名前と、部屋ごとの再接続用の合言葉（token）を、このブラウザに覚えておく。
 * 保存できない環境（プライベートウィンドウ等）でも、ゲームは続けられるようにする。
 */
export class PlayerIdentity {
  static #NAME_KEY = 'fc.playerName';
  static #TOKEN_PREFIX = 'fc.token.';

  constructor({ local = PlayerIdentity.#storage('localStorage'), session = PlayerIdentity.#storage('sessionStorage') } = {}) {
    this.local = local;
    this.session = session;
  }

  get name() { return this.#read(this.local, PlayerIdentity.#NAME_KEY) ?? ''; }
  set name(value) { this.#write(this.local, PlayerIdentity.#NAME_KEY, value); }

  tokenFor(code) { return this.#read(this.session, PlayerIdentity.#TOKEN_PREFIX + code); }
  rememberToken(code, token) { this.#write(this.session, PlayerIdentity.#TOKEN_PREFIX + code, token); }
  forgetToken(code) {
    try { this.session?.removeItem(PlayerIdentity.#TOKEN_PREFIX + code); } catch { /* 無視 */ }
  }

  #read(store, key) {
    try { return store?.getItem(key) ?? null; } catch { return null; }
  }

  #write(store, key, value) {
    try { store?.setItem(key, value); } catch { /* 保存できなくても続ける */ }
  }

  static #storage(name) {
    try { return globalThis[name] ?? null; } catch { return null; }
  }
}

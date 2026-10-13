/**
 * サーバーの時計を推定する。
 * ping を送った時刻（t）と、返ってきた時のサーバー時刻（serverNow）から、
 * 自分の時計とのずれを求める。往復が速かった（信頼できる）測定ほど優先する。
 */
export class ServerClock {
  #samples = [];

  constructor({ maxSamples = 6, now = () => Date.now() } = {}) {
    this.maxSamples = maxSamples;
    this.localNow = now;
  }

  get hasSample() { return this.#samples.length > 0; }

  /** pong を受け取ったときに呼ぶ */
  addSample({ t, serverNow }) {
    const received = this.localNow();
    const rtt = Math.max(0, received - t);
    const offset = serverNow + rtt / 2 - received;
    this.#samples.push({ rtt, offset });
    if (this.#samples.length > this.maxSamples) this.#samples.shift();
  }

  /** 推定したサーバーの現在時刻（ミリ秒） */
  now() {
    return this.localNow() + this.#bestOffset();
  }

  #bestOffset() {
    if (!this.#samples.length) return 0;
    return this.#samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
  }
}

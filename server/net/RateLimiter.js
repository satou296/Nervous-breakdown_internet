/**
 * 1つの接続から短時間に大量のメッセージが来ないようにする（トークンバケット方式）。
 * 1秒に perSecond 個まで回復し、最大 burst 個までためておける。
 */
export class RateLimiter {
  #tokens;
  #last;

  constructor({ perSecond, burst, now = () => Date.now() }) {
    this.perSecond = perSecond;
    this.burst = burst;
    this.now = now;
    this.#tokens = burst;
    this.#last = now();
  }

  /** 1つ使えたら true、使い切っていたら false */
  tryTake() {
    const t = this.now();
    this.#tokens = Math.min(this.burst, this.#tokens + ((t - this.#last) / 1000) * this.perSecond);
    this.#last = t;
    if (this.#tokens < 1) return false;
    this.#tokens -= 1;
    return true;
  }
}

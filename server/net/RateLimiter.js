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
    if (!this.canTake()) return false;
    this.#tokens -= 1;
    return true;
  }

  /** 使わずに、いま1つ使えるかだけを確かめる */
  canTake() {
    this.#refill();
    return this.#tokens >= 1;
  }

  /** 満タンまで回復している（しばらく使われていない） */
  isFull() {
    this.#refill();
    return this.#tokens >= this.burst;
  }

  #refill() {
    const t = this.now();
    this.#tokens = Math.min(this.burst, this.#tokens + ((t - this.#last) / 1000) * this.perSecond);
    this.#last = t;
  }
}

/**
 * 住所などの「鍵」ごとに RateLimiter を持つ。満タンに戻った鍵は sweep() で忘れる（メモリを増やし続けない）。
 */
export class KeyedRateLimiter {
  #limiters = new Map();

  constructor({ perSecond, burst, now = () => Date.now() }) {
    this.options = { perSecond, burst, now };
  }

  get size() { return this.#limiters.size; }

  tryTake(key) {
    return this.#limiterOf(key).tryTake();
  }

  canTake(key) {
    return this.#limiters.get(key)?.canTake() ?? true;
  }

  sweep() {
    for (const [key, limiter] of this.#limiters) {
      if (limiter.isFull()) this.#limiters.delete(key);
    }
  }

  #limiterOf(key) {
    let limiter = this.#limiters.get(key);
    if (!limiter) {
      limiter = new RateLimiter(this.options);
      this.#limiters.set(key, limiter);
    }
    return limiter;
  }
}

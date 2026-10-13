/**
 * 腕の伸び具合（メートル）。入力に応じて伸び縮みし、0〜max に収まる。
 * 見た目や入力の種類は知らない。
 */
export class ArmReach {
  #length = 0;

  constructor({ maxReach, extendSpeed, relaxSpeed }) {
    this.maxReach = maxReach;
    this.extendSpeed = extendSpeed;
    this.relaxSpeed = relaxSpeed;
  }

  get length() { return this.#length; }
  get fraction() { return this.#length / this.maxReach; }

  /** @param {number} axis  +1 で伸ばす、-1 で縮める、0 でそのまま */
  adjust(axis, dt) {
    this.#setLength(this.#length + axis * this.extendSpeed * dt);
  }

  /** 操作できないとき：自然に元の長さへ戻る */
  relax(dt) {
    this.#setLength(this.#length - this.relaxSpeed * dt);
  }

  reset() {
    this.#length = 0;
  }

  #setLength(value) {
    this.#length = Math.min(this.maxReach, Math.max(0, value));
  }
}

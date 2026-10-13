import { randomInt } from 'node:crypto';
import { LIMITS } from '../../src/net/Protocol.js';

/**
 * 招待URLに入れる部屋番号（例：K7RQ2）を作る。推測されにくいよう暗号用の乱数を使う。
 */
export class RoomCodeGenerator {
  constructor({ alphabet = LIMITS.roomCodeAlphabet, length = LIMITS.roomCodeLength, randomIndex = n => randomInt(n) } = {}) {
    this.alphabet = alphabet;
    this.length = length;
    this.randomIndex = randomIndex;
  }

  /** @param {(code: string) => boolean} isTaken すでに使われている番号なら true */
  next(isTaken) {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < this.length; i++) code += this.alphabet[this.randomIndex(this.alphabet.length)];
      if (!isTaken(code)) return code;
    }
    throw new Error('部屋番号を作れませんでした');
  }
}

import { CalmDrift } from './CalmDrift.js';
import { RoamingDrift } from './RoamingDrift.js';

/**
 * 難易度の drift 定義（{ type, ... }）から DriftPattern を作る。
 * register() で新しい動き方を追加できる（Open/Closed）。
 */
export class DriftFactory {
  #creators = new Map();

  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.register('calm', (spec, random) => new CalmDrift({ amplitude: spec.amplitude, random }));
    this.register('roam', (spec, random) => new RoamingDrift({ range: spec.range, speed: spec.speed, random }));
  }

  register(type, creator) {
    this.#creators.set(type, creator);
  }

  /** @param {() => number} [random] カードごとの乱数（動きを再現したいときは種付き） */
  create(spec, random = this.random) {
    const creator = this.#creators.get(spec.type);
    if (!creator) throw new Error(`未知の漂い方です: ${spec.type}`);
    return creator(spec, random);
  }
}

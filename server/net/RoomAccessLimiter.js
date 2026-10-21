import { KeyedRateLimiter } from './RateLimiter.js';

/**
 * 部屋を作る回数と、部屋番号を外した回数を、住所ごとに制限する。
 * - 部屋を作っては切断するのを繰り返して、部屋数の上限を埋められないように
 * - 部屋番号を総当たりして、他人の部屋に入れないように
 * 住所が分からない接続は、その接続ごとに数える。
 */
export class RoomAccessLimiter {
  constructor({ createLimit, joinMissLimit, now = () => Date.now() }) {
    this.creates = new KeyedRateLimiter({ ...createLimit, now });
    this.joinMisses = new KeyedRateLimiter({ ...joinMissLimit, now });
  }

  /** 部屋を作ってよければ1回分を使って true */
  tryCreate(connection) {
    return this.creates.tryTake(keyOf(connection));
  }

  /** 部屋番号を外しすぎていなければ true（まだ回数は使わない） */
  canTryJoin(connection) {
    return this.joinMisses.canTake(keyOf(connection));
  }

  /** 部屋番号を外した */
  recordJoinMiss(connection) {
    this.joinMisses.tryTake(keyOf(connection));
  }

  /** しばらく使われていない住所を忘れる（定期的に呼ぶ） */
  sweep() {
    this.creates.sweep();
    this.joinMisses.sweep();
  }
}

function keyOf(connection) {
  return connection.address ?? `connection:${connection.id}`;
}

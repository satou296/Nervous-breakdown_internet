/**
 * ゲーム内時計で動く Updatable のまとまり。
 * GameLoop にはこれ1つを登録し、ポーズで止めたいもの（カード・ゲーム進行など）を中に入れる。
 * 中の要素には「ゲーム内の経過秒」が渡されるので、ポーズ明けも動きが飛ばない。
 */
export class PausableTimeline {
  #items = [];

  constructor(clock) {
    this.clock = clock;
  }

  add(updatable) {
    if (typeof updatable?.update !== 'function') {
      throw new TypeError('PausableTimeline.add には update(dt, elapsed) を持つオブジェクトを渡してください');
    }
    this.#items.push(updatable);
    return this;
  }

  update(dt) {
    const gameDt = this.clock.advance(dt);
    if (gameDt === 0) return;
    const elapsed = this.clock.elapsedSec;
    for (const item of this.#items) item.update(gameDt, elapsed);
  }
}

// 時計・スケジューラ・漂い方の単体テスト：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PausableClock } from '../src/core/PausableClock.js';
import { PausableTimeline } from '../src/core/PausableTimeline.js';
import { Scheduler } from '../src/core/Scheduler.js';
import { GameStats } from '../src/domain/GameStats.js';
import { RoamingDrift } from '../src/render/cards/drift/RoamingDrift.js';
import { CalmDrift } from '../src/render/cards/drift/CalmDrift.js';
import { DIFFICULTIES } from '../src/config/Difficulties.js';

const vec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });

test('ポーズ中はゲーム内時計が進まない', () => {
  const clock = new PausableClock();
  clock.advance(1);
  clock.pause();
  assert.equal(clock.advance(5), 0);
  clock.resume();
  clock.advance(0.5);
  assert.equal(clock.nowMs, 1500);
});

test('ポーズ中は予約した処理が実行されず、再開後に実行される', () => {
  const clock = new PausableClock();
  const scheduler = new Scheduler(clock);
  let fired = 0;
  scheduler.after(1000, () => fired++);
  clock.advance(0.6); scheduler.update();
  clock.pause();
  clock.advance(10); scheduler.update();
  assert.equal(fired, 0);
  clock.resume();
  clock.advance(0.5); scheduler.update();
  assert.equal(fired, 1);
});

test('cancelAll で予約はすべて取り消される', () => {
  const clock = new PausableClock();
  const scheduler = new Scheduler(clock);
  let fired = 0;
  scheduler.after(100, () => { fired++; scheduler.cancelAll(); });
  scheduler.after(100, () => fired++);
  clock.advance(1); scheduler.update();
  assert.equal(fired, 1);
  assert.equal(scheduler.pendingCount, 0);
});

test('タイマー（GameStats）はポーズ中の時間を数えない', () => {
  const clock = new PausableClock();
  const stats = new GameStats(() => clock.nowMs);
  stats.markStarted();
  clock.advance(2);
  clock.pause(); clock.advance(30); clock.resume();
  clock.advance(1);
  assert.equal(stats.elapsedMs, 3000);
});

test('PausableTimeline はポーズ中に中身を更新しない', () => {
  const clock = new PausableClock();
  let calls = 0;
  const timeline = new PausableTimeline(clock).add({ update: () => calls++ });
  timeline.update(0.016);
  clock.pause();
  timeline.update(0.016);
  assert.equal(calls, 1);
});

test('むずかしい：動き回るが、ずれは必ず範囲内に収まる', () => {
  const { range, speed } = DIFFICULTIES.hard.drift;
  const drift = new RoamingDrift({ range, speed });
  const out = vec();
  let maxX = 0;
  for (let t = 0; t < 300; t += 0.1) {
    drift.offsetAt(t, out);
    assert.ok(Math.abs(out.x) <= range.x + 1e-9);
    assert.ok(Math.abs(out.y) <= range.y + 1e-9);
    assert.ok(Math.abs(out.z) <= range.z + 1e-9);
    maxX = Math.max(maxX, Math.abs(out.x));
  }
  assert.ok(maxX > range.x * 0.5, '左右に大きく動いている');
});

test('むずかしいは、ふつうより大きく動く', () => {
  const calm = new CalmDrift({ amplitude: DIFFICULTIES.normal.drift.amplitude });
  const roam = new RoamingDrift(DIFFICULTIES.hard.drift);
  const span = d => { let lo = Infinity, hi = -Infinity; const o = vec(); for (let t = 0; t < 300; t += 0.1) { d.offsetAt(t, o); lo = Math.min(lo, o.x); hi = Math.max(hi, o.x); } return hi - lo; };
  assert.ok(span(roam) > span(calm) * 2);
});

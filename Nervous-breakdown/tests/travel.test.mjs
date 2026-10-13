// 極モード（定位置の渡り歩き・触れても止めない）の単体テスト：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RandomWaypointTravel } from '../src/render/cards/travel/RandomWaypointTravel.js';
import { StationaryAnchor } from '../src/render/cards/travel/StationaryAnchor.js';
import { AnchorTravelFactory } from '../src/render/cards/travel/AnchorTravelFactory.js';
import { PalmHold } from '../src/physics/PalmHold.js';
import { DIFFICULTIES } from '../src/config/Difficulties.js';

const v = (x, y, z) => ({ x, y, z });

test('定位置は目的地へ一定の速さで進み、着いたら次の目的地を選ぶ', () => {
  const points = [v(1, 0, 0), v(1, 2, 0)];
  let picked = 0;
  const travel = new RandomWaypointTravel({
    pickPoint: () => points[picked++ % points.length],
    speed: { min: 0.5, max: 0.5 }
  });
  const anchor = v(0, 0, 0);
  travel.step(anchor, 1);
  assert.ok(Math.abs(anchor.x - 0.5) < 1e-9, '1秒で 0.5m 進む');
  travel.step(anchor, 1);
  assert.ok(Math.abs(anchor.x - 1) < 1e-9, '目的地を通り過ぎない');
  travel.step(anchor, 0.1); // 到着 → 次の目的地
  assert.deepEqual(travel.target, v(1, 2, 0));
  travel.step(anchor, 1);
  assert.ok(anchor.y > 0.4, '次の目的地へ向かって動き出す');
});

test('目的地は毎回ランダムに選び直され、範囲内の点だけを使う', () => {
  const inRange = p => p.x >= -1 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  const travel = new RandomWaypointTravel({
    pickPoint: () => v(Math.random() * 2 - 1, Math.random(), 0),
    speed: { min: 2, max: 4 }
  });
  const anchor = v(0, 0.5, 0);
  const targets = new Set();
  for (let i = 0; i < 2000; i++) {
    travel.step(anchor, 0.05);
    assert.ok(inRange(anchor), '定位置は範囲の外へ出ない');
    targets.add(travel.target);
  }
  assert.ok(targets.size > 5, '何度も目的地を選び直している');
});

test('極以外は定位置が動かない', () => {
  const factory = new AnchorTravelFactory({ layout: { randomPoint: () => v(9, 9, 9) } });
  for (const id of ['normal', 'hard', 'expert']) {
    const travel = factory.create(DIFFICULTIES[id].travel);
    assert.ok(travel instanceof StationaryAnchor, id);
    const anchor = v(1, 2, 3);
    travel.step(anchor, 10);
    assert.deepEqual(anchor, v(1, 2, 3));
  }
  assert.ok(factory.create(DIFFICULTIES.master.travel) instanceof RandomWaypointTravel);
});

test('極は達人と同じ操作で、触れてもカードを止めない', () => {
  const { expert, master } = DIFFICULTIES;
  assert.equal(master.interaction, expert.interaction);
  assert.equal(expert.holdOnTouch, true);
  assert.equal(master.holdOnTouch, false);
  assert.deepEqual(master.drift, DIFFICULTIES.hard.drift, 'カードの揺れ動きは、むずかしいと同じ');
});

test('押さえない設定のときは、触れていてもカードを止めない', () => {
  const card = { held: false, setHeld(h) { this.held = h; } };
  const sensor = { current: card };
  let enabled = false;
  const hold = new PalmHold({ sensor, isEnabled: () => enabled });
  hold.update();
  assert.equal(card.held, false, '極：止めない');
  enabled = true;
  hold.update();
  assert.equal(card.held, true, '達人：止める');
  sensor.current = null;
  hold.update();
  assert.equal(card.held, false, '離れたら放す');
});

// 腕の伸縮・当たり判定・カードの選び方の単体テスト：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArmReach } from '../src/physics/ArmReach.js';
import { Knockback } from '../src/physics/Knockback.js';
import { closestPointOnSegment } from '../src/physics/vectorMath.js';
import { PalmContactSensor } from '../src/physics/PalmContactSensor.js';
import { ArmCollisionResolver } from '../src/physics/ArmCollisionResolver.js';
import { ArmVisibility } from '../src/render/player/ArmVisibility.js';
import { PointSelection, ReachSelection } from '../src/app/selection/CardSelectionMethods.js';
import { DIFFICULTIES } from '../src/config/Difficulties.js';

const v = (x, y, z) => ({ x, y, z });
const CONFIG = {
  armRadius: 0.1, cardRadius: 0.35,
  impulseBase: 2, impulseFromSpeed: 0.5, maxImpulse: 7, spinKick: 2
};

/** CardView の代わり：位置と、押された／弾かれた記録だけ持つ */
function fakeCard(name, position) {
  return {
    name, isPickable: true, object: { position: { ...position } },
    pushes: [], knocks: [],
    push(o) { this.pushes.push(o); this.object.position.x += o.x; this.object.position.y += o.y; this.object.position.z += o.z; },
    knock(i, s) { this.knocks.push({ i, s }); }
  };
}

const ARM_POINTS = { shoulder: v(0, 0, 0), wrist: v(0, 0, -1), palm: v(0, 0, -3), tip: v(0, 0, -4) };
const arm = { contactPoints: () => ARM_POINTS };

function makeResolver(cards, isExempt = () => false) {
  return new ArmCollisionResolver({ arm, field: { views: cards }, isEnabled: () => true, isExempt, config: CONFIG });
}

test('W で伸び、S で縮み、0〜最大の範囲に収まる', () => {
  const reach = new ArmReach({ maxReach: 9, extendSpeed: 3, relaxSpeed: 6 });
  reach.adjust(+1, 1);
  assert.equal(reach.length, 3);
  reach.adjust(+1, 10);
  assert.equal(reach.length, 9);
  reach.adjust(-1, 1);
  assert.equal(reach.length, 6);
  reach.adjust(-1, 10);
  assert.equal(reach.length, 0);
});

test('線分上の最も近い点', () => {
  const out = v(0, 0, 0);
  closestPointOnSegment(v(1, 5, 0), v(0, 0, 0), v(0, 10, 0), out);
  assert.deepEqual(out, v(0, 5, 0));
  closestPointOnSegment(v(0, -3, 0), v(0, 0, 0), v(0, 10, 0), out);
  assert.deepEqual(out, v(0, 0, 0));
});

test('弾かれたカードは動き、やがて止まる', () => {
  const k = new Knockback({ drag: 2 });
  k.apply(v(3, 0, 0), 1);
  let moved = 0;
  for (let i = 0; i < 300; i++) moved += k.step(1 / 60).x;
  assert.ok(moved > 1, '押された方向へ進む');
  assert.equal(k.isMoving, false);
});

test('手のひらが触れているカードを1枚だけ見つける（いちばん近いもの）', () => {
  const near = fakeCard('near', v(0, 0.1, -3.1));
  const far = fakeCard('far', v(0.4, 0, -3));
  const away = fakeCard('away', v(3, 0, -3));
  const sensor = new PalmContactSensor({ arm, field: { views: [far, near, away] }, isEnabled: () => true, palmRadius: 0.6 });
  sensor.update();
  assert.equal(sensor.current, near);
});

test('一度触れたカードは、少し離れても触れたままとみなす', () => {
  const card = fakeCard('drift', v(0, 0, -3.3));
  const sensor = new PalmContactSensor({ arm, field: { views: [card] }, isEnabled: () => true, palmRadius: 0.6, releaseRadius: 0.9 });
  sensor.update();
  assert.equal(sensor.current, card);
  card.object.position.z = -3.75; // 0.75 離れた（触れ始めの距離より遠いが、離す距離より近い）
  sensor.update();
  assert.equal(sensor.current, card);
  card.object.position.z = -4.2;
  sensor.update();
  assert.equal(sensor.current, null);
});

test('手のひらで触れているだけでは選ばれない（クリックしたときだけ選ぶ）', () => {
  const card = { id: 7 };
  const sensor = { current: null };
  const selection = new ReachSelection({ contactSensor: sensor });
  assert.equal(selection.cardFromTap({ x: 0, y: 0 }), null, '触れていなければクリックしても選ばない');
  sensor.current = { card };
  assert.equal(selection.cardFromTap({ x: 0, y: 0 }), card, '触れている上でクリックすると選ぶ');
});

test('触れているカードは弾かず、腕に当たった他のカードは弾く', () => {
  const held = fakeCard('held', v(0, 0, -3.1));
  const side = fakeCard('side', v(0.2, 0, -2));
  makeResolver([held, side], view => view === held).update(1 / 60);
  assert.equal(held.knocks.length, 0);
  assert.equal(side.knocks.length, 1);
  assert.ok(side.knocks[0].i.x > 0, '腕から離れる向き（+x）へ弾く');
  assert.ok(side.object.position.x >= 0.45 - 1e-9, 'めり込まない位置まで押し出す');
});

test('当たり続けていても、弾くのは当たった瞬間の1回だけ', () => {
  const card = fakeCard('stay', v(0.1, 0, -2));
  const resolver = makeResolver([card]);
  resolver.update(1 / 60);
  card.object.position.x = 0.1; // まだめり込んでいる
  resolver.update(1 / 60);
  assert.equal(card.knocks.length, 1);
  assert.equal(card.pushes.length, 2);
});

test('腕を伸ばすほど右手と袖が透ける', () => {
  const hand = { reach: 0 };
  const m = { opacity: 1, transparent: false };
  const visibility = new ArmVisibility({ hand, materials: [m], minOpacity: 0.3, fadeOverReach: 1 });
  visibility.update();
  assert.equal(m.opacity, 1);
  hand.reach = 0.5; visibility.update();
  assert.ok(m.opacity < 1 && m.opacity > 0.3);
  hand.reach = 5; visibility.update();
  assert.equal(m.opacity, 0.3);
});

test('達人だけが腕を使い、カーソルを合わせても光らせない', () => {
  assert.equal(DIFFICULTIES.expert.interaction, 'reach');
  assert.equal(DIFFICULTIES.hard.interaction, 'point');
  const card = { id: 1 };
  const point = new PointSelection({ picker: { pick: () => ({ card }) } });
  assert.equal(point.cardFromTap({ x: 0, y: 0 }), card);
  assert.equal(point.usesHover, true);
  const reach = new ReachSelection({ contactSensor: { current: null } });
  assert.equal(reach.usesReach, true);
  assert.equal(reach.usesHover, false);
});

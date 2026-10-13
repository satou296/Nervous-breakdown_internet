/**
 * 当たり判定用の小さなベクトル計算。{x, y, z} を持つ任意のオブジェクトで動く
 * （three.js の Vector3 でも、ただのオブジェクトでもよい）。
 */

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** 点 p に最も近い、線分 a–b 上の点を out に書き込む */
export function closestPointOnSegment(p, a, b, out) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const lengthSq = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (lengthSq > 1e-12) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / lengthSq;
    t = Math.min(1, Math.max(0, t));
  }
  out.x = a.x + abx * t;
  out.y = a.y + aby * t;
  out.z = a.z + abz * t;
  return out;
}

/** from → to 方向の単位ベクトル。重なっているときは fallback を返す */
export function directionBetween(from, to, fallback = { x: 0, y: 1, z: 0 }) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) return { ...fallback };
  return { x: dx / len, y: dy / len, z: dz / len };
}

export function scaled(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

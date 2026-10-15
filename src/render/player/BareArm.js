import { THREE } from '../../lib/three.js';

/** 肩から手首までの曲線を何区切りで描くか */
const CURVE_SEGMENTS = 28;
/** 腕の周りを何角形で描くか */
const RADIAL_SEGMENTS = 18;
/** 手首の先を丸く閉じる段数（手のひらの中に隠れる） */
const CAP_SEGMENTS = 4;
/** 肩の側は手首よりこの割合だけ太くする */
const SHOULDER_THICKEN = 0.15;
/** 曲がり具合：肩と手首の距離に対する、両端の向きを保つ長さの割合 */
const BEND = 0.4;

const UP = new THREE.Vector3(0, 1, 0);
const SIDE = new THREE.Vector3(1, 0, 0);

/**
 * 素肌の腕：画面の外の肩（のさらに奥）から手首までを、継ぎ目のない1本の管で描く。Updatable。
 * 肩からはまっすぐ出て、手首では手の向きにそろうよう滑らかに曲げるので、肘のような折れ目ができない。
 * 端が画面に入らないので、腕を伸ばしても縮めても、どこまでも続いているように見える。
 * 手（hand）は camera の子にある root と、カメラ基準の肩の位置 shoulder を持つもの。
 */
export class BareArm {
  #far = new THREE.Vector3();
  #wrist = new THREE.Vector3();
  #forward = new THREE.Vector3();
  #toWrist = new THREE.Vector3();
  #c1 = new THREE.Vector3();
  #c2 = new THREE.Vector3();
  #point = new THREE.Vector3();
  #tangent = new THREE.Vector3();
  #normal = new THREE.Vector3();
  #binormal = new THREE.Vector3();
  #radial = new THREE.Vector3();

  /**
   * @param {object} p
   * @param {THREE.Camera} p.camera
   * @param {{ root: THREE.Object3D, shoulder: THREE.Vector3 }} p.hand
   * @param {THREE.Object3D} p.wrist   手のモデルの手首の目印（+Z が指先の向き）
   * @param {number} p.radius          手首での腕の太さ
   * @param {number} p.beyondShoulder  肩よりさらに奥（画面の外）まで延ばす長さ
   * @param {THREE.Material} p.material 手と同じ肌の材質（透かすときも一緒に透ける）
   */
  constructor({ camera, hand, wrist, radius, beyondShoulder, material }) {
    this.camera = camera;
    this.hand = hand;
    this.wrist = wrist;
    this.radius = radius;
    this.beyondShoulder = beyondShoulder;
    this.mesh = new THREE.Mesh(this.#createGeometry(), material);
    this.mesh.frustumCulled = false; // 毎フレーム形が変わるので、外枠での間引きはしない
    camera.add(this.mesh);
  }

  /** 輪の数：肩の奥の1つ＋肩から手首までの曲線＋手首の先を閉じる分 */
  static get ringCount() {
    return 1 + (CURVE_SEGMENTS + 1) + CAP_SEGMENTS;
  }

  #createGeometry() {
    const rings = BareArm.ringCount;
    const perRing = RADIAL_SEGMENTS + 1; // 継ぎ目の頂点は重ねて持つ
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rings * perRing * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rings * perRing * 3), 3));
    const index = [];
    for (let r = 0; r < rings - 1; r++) {
      for (let s = 0; s < RADIAL_SEGMENTS; s++) {
        const a = r * perRing + s;
        const b = a + perRing;
        index.push(a, a + 1, b, b, a + 1, b + 1); // 外側が表になる向き
      }
    }
    geometry.setIndex(index);
    return geometry;
  }

  update() {
    this.#measure();
    const position = this.mesh.geometry.attributes.position;
    const normal = this.mesh.geometry.attributes.normal;
    const shoulder = this.hand.shoulder;
    const r = this.radius;
    let ring = 0;

    // 肩の奥：肩から手首へ向かう線を、そのまま後ろへ延ばした点
    this.#tangent.copy(this.#toWrist).normalize();
    this.#startFrame(this.#tangent);
    this.#writeRing(position, normal, ring++, this.#far, r * (1 + SHOULDER_THICKEN), 0);

    // 肩から手首：両端の向き（肩→手首の線・手の向き）を保つ3次ベジェ曲線
    for (let i = 0; i <= CURVE_SEGMENTS; i++) {
      const t = i / CURVE_SEGMENTS;
      this.#bezier(shoulder, t, this.#point, this.#tangent);
      this.#transportFrame(this.#tangent);
      this.#writeRing(position, normal, ring++, this.#point, r * (1 + SHOULDER_THICKEN * (1 - t)), 0);
    }

    // 手首の先：半球状にすぼめて閉じる（手のひらの付け根の中に収まる）
    for (let i = 1; i <= CAP_SEGMENTS; i++) {
      const angle = (i / CAP_SEGMENTS) * (Math.PI / 2);
      this.#point.copy(this.#wrist).addScaledVector(this.#forward, Math.sin(angle) * r);
      this.#writeRing(position, normal, ring++, this.#point, Math.cos(angle) * r, Math.sin(angle));
    }

    position.needsUpdate = true;
    normal.needsUpdate = true;
  }

  /** 手首の位置と手の向き、肩の奥の点を、カメラ基準の座標で求める */
  #measure() {
    const { camera, wrist } = this;
    camera.worldToLocal(wrist.getWorldPosition(this.#wrist));
    camera.worldToLocal(wrist.localToWorld(this.#forward.set(0, 0, 1)));
    this.#forward.sub(this.#wrist).normalize();

    const shoulder = this.hand.shoulder;
    this.#toWrist.subVectors(this.#wrist, shoulder);
    const span = this.#toWrist.length();
    const dir = this.#tangent.copy(this.#toWrist).divideScalar(span || 1);
    this.#far.copy(shoulder).addScaledVector(dir, -this.beyondShoulder);
    this.#c1.copy(shoulder).addScaledVector(dir, span * BEND);
    this.#c2.copy(this.#wrist).addScaledVector(this.#forward, -span * BEND);
  }

  /** 3次ベジェ曲線（肩・c1・c2・手首）の点と接線 */
  #bezier(shoulder, t, outPoint, outTangent) {
    const u = 1 - t;
    const p0 = shoulder, p1 = this.#c1, p2 = this.#c2, p3 = this.#wrist;
    outPoint.copy(p0).multiplyScalar(u * u * u)
      .addScaledVector(p1, 3 * u * u * t)
      .addScaledVector(p2, 3 * u * t * t)
      .addScaledVector(p3, t * t * t);
    outTangent.copy(p1).sub(p0).multiplyScalar(3 * u * u)
      .addScaledVector(this.#radial.copy(p2).sub(p1), 6 * u * t)
      .addScaledVector(this.#radial.copy(p3).sub(p2), 3 * t * t);
    if (outTangent.lengthSq() < 1e-12) outTangent.copy(this.#forward);
    outTangent.normalize();
  }

  /** 輪の向きの基準を、肩の奥での向きから決める */
  #startFrame(tangent) {
    const reference = Math.abs(tangent.dot(UP)) > 0.95 ? SIDE : UP;
    this.#normal.crossVectors(tangent, reference).normalize();
    this.#binormal.crossVectors(tangent, this.#normal);
  }

  /** 前の輪の向きを、ねじれないよう新しい接線に沿わせて運ぶ */
  #transportFrame(tangent) {
    this.#normal.addScaledVector(tangent, -this.#normal.dot(tangent)).normalize();
    this.#binormal.crossVectors(tangent, this.#normal);
  }

  /**
   * 1つの輪の頂点と法線を書き込む。
   * @param {number} lean 法線を手の向きへ傾ける割合（0＝横向き、1＝手の向き。先端を丸めるのに使う）
   */
  #writeRing(position, normal, ring, center, radius, lean) {
    const perRing = RADIAL_SEGMENTS + 1;
    const side = Math.cos(Math.asin(lean));
    for (let s = 0; s <= RADIAL_SEGMENTS; s++) {
      const a = (s / RADIAL_SEGMENTS) * Math.PI * 2;
      this.#radial.copy(this.#normal).multiplyScalar(Math.cos(a)).addScaledVector(this.#binormal, Math.sin(a));
      const k = ring * perRing + s;
      position.setXYZ(k,
        center.x + this.#radial.x * radius,
        center.y + this.#radial.y * radius,
        center.z + this.#radial.z * radius);
      normal.setXYZ(k,
        this.#radial.x * side + this.#forward.x * lean,
        this.#radial.y * side + this.#forward.y * lean,
        this.#radial.z * side + this.#forward.z * lean);
    }
  }
}

import { THREE } from '../../lib/three.js';
import { lookQuaternion, ndcToCameraDirection } from './handMath.js';

const REST_AIM = Object.freeze({ x: 0.15, y: -0.35 });
const POKE_DECAY = 3.2;
const POKE_REACH = 0.07;
/** この長さまで伸ばすと、手がカーソルの視線上に乗る（指先がカーソルの指す所へ進む） */
const ALIGN_TO_RAY_AT = 1.0;

/**
 * 右手：カーソルの方向を人差し指でさし、クリックすると突く。
 * 腕の伸び（reachProvider が返すメートル）の分だけ、指す方向へ手が前に出る。
 * 当たり判定用に、肩・手首・指先のワールド座標を返せる。Updatable。
 */
export class PointingHand {
  #poke = 0;
  #aimProvider = () => null;
  #reachProvider = () => 0;
  #dir = new THREE.Vector3();
  #pos = new THREE.Vector3();
  #target = new THREE.Vector3();
  #quat = new THREE.Quaternion();
  #points = {
    shoulder: new THREE.Vector3(), wrist: new THREE.Vector3(),
    palm: new THREE.Vector3(), tip: new THREE.Vector3()
  };
  #reach = 0;

  constructor({ camera, model, basePosition, shoulderPosition, scale = 0.9 }) {
    this.camera = camera;
    this.base = basePosition.clone();
    this.shoulder = shoulderPosition.clone();
    this.root = new THREE.Group();
    this.root.add(model);
    this.root.scale.setScalar(scale);
    this.root.position.copy(this.base);
    this.fingertip = model.userData.fingertip ?? this.root;
    this.palm = model.userData.palm ?? this.root;
    camera.add(this.root);
  }

  setAimProvider(provider) {
    this.#aimProvider = provider;
  }

  /** @param {() => number} provider いまの腕の伸び（メートル） */
  setReachProvider(provider) {
    this.#reachProvider = provider;
  }

  /** いまの腕の伸び（メートル） */
  get reach() { return this.#reach; }

  poke() {
    this.#poke = 1;
  }

  /** 当たり判定用：肩・手首・手のひら・指先のワールド座標（毎回同じオブジェクトを使い回す） */
  contactPoints() {
    const p = this.#points;
    this.camera.localToWorld(p.shoulder.copy(this.shoulder));
    this.root.getWorldPosition(p.wrist);
    this.palm.getWorldPosition(p.palm);
    this.fingertip.getWorldPosition(p.tip);
    return p;
  }

  update(dt, elapsed) {
    const aim = this.#aimProvider() ?? REST_AIM;
    const dir = ndcToCameraDirection(aim, this.camera, this.#dir);

    this.#poke = Math.max(0, this.#poke - dt * POKE_DECAY);
    const poke = this.#poke > 0 ? Math.sin(Math.PI * (1 - this.#poke)) * POKE_REACH : 0;
    const reach = this.#reachProvider();
    this.#reach = reach;

    const offRay = 1 - Math.min(1, reach / ALIGN_TO_RAY_AT);
    this.#pos.set(
      (this.base.x + aim.x * 0.06) * offRay,
      (this.base.y + aim.y * 0.05 + Math.sin(elapsed * 1.6) * 0.003) * offRay,
      this.base.z * offRay
    ).addScaledVector(dir, reach + poke);
    // 伸ばしている間は素早く追従させる（遠くで遅れると狙いにくい）
    const follow = reach > 0.05 ? 22 : 14;
    this.root.position.lerp(this.#pos, 1 - Math.exp(-dt * follow));

    this.#target.copy(dir).multiplyScalar(reach + 1.6); // カーソルの視線上の、手より先の点を指す
    lookQuaternion(this.root.position, this.#target, this.#quat);
    this.root.quaternion.slerp(this.#quat, 1 - Math.exp(-dt * 12));
  }
}

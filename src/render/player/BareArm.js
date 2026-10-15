import { THREE } from '../../lib/three.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * 素肌の腕：画面の外の肩（のさらに奥）から、手のモデルの前腕の根元までをつないで描く。Updatable。
 * 端が画面に入らないので、腕を伸ばしても縮めても、どこまでも続いているように見える。
 * 手（hand）は camera の子にある root と、カメラ基準の肩の位置 shoulder を持つもの。
 */
export class BareArm {
  #from = new THREE.Vector3();
  #to = new THREE.Vector3();
  #dir = new THREE.Vector3();

  /**
   * @param {object} p
   * @param {THREE.Camera} p.camera
   * @param {{ root: THREE.Object3D, shoulder: THREE.Vector3 }} p.hand
   * @param {THREE.Object3D} p.forearmEnd 手のモデルの前腕の根元の目印
   * @param {THREE.Material} p.material   手と同じ肌の材質（透かすときも一緒に透ける）
   */
  constructor({ camera, hand, forearmEnd, radius, beyondShoulder, material }) {
    this.camera = camera;
    this.hand = hand;
    this.forearmEnd = forearmEnd;
    this.beyondShoulder = beyondShoulder;
    const geometry = new THREE.CylinderGeometry(radius, radius * 1.15, 1, 18, 1, true);
    geometry.translate(0, 0.5, 0); // 根元を原点に
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    camera.add(this.mesh);
  }

  update() {
    // 前腕の根元を、カメラ基準の座標にする
    this.camera.worldToLocal(this.forearmEnd.getWorldPosition(this.#to));
    this.#dir.subVectors(this.#to, this.hand.shoulder).normalize();
    this.#from.copy(this.hand.shoulder).addScaledVector(this.#dir, -this.beyondShoulder);
    const length = this.#from.distanceTo(this.#to);
    this.mesh.position.copy(this.#from);
    this.mesh.quaternion.setFromUnitVectors(UP, this.#dir);
    this.mesh.scale.set(1, length, 1);
  }
}

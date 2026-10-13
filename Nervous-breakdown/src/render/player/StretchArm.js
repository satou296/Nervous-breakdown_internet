import { THREE } from '../../lib/three.js';

const UP = new THREE.Vector3(0, 1, 0);
const SLEEVE_OVERLAP = 0.3; // 手のモデルにもともと付いている袖の長さぶん、手前で止める
const MIN_REACH = 0.05;     // これより伸びていなければ表示しない

/**
 * 伸びた腕の見た目：肩から手首まで袖を引き伸ばして描く。Updatable。
 * 腕が伸びていないときは表示しない（手のモデルの袖だけで足りる）。
 */
export class StretchArm {
  #dir = new THREE.Vector3();
  #end = new THREE.Vector3();

  constructor({ camera, hand, radius, material = new THREE.MeshStandardMaterial({ color: 0x28324a, roughness: 0.92 }) }) {
    this.hand = hand;
    this.material = material;
    const geometry = new THREE.CylinderGeometry(radius * 0.8, radius, 1, 16, 1, true);
    geometry.translate(0, 0.5, 0); // 根元を原点に
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
    camera.add(this.mesh);
  }

  update() {
    if (this.hand.reach < MIN_REACH) {
      this.mesh.visible = false;
      return;
    }
    const from = this.hand.shoulder;
    const wrist = this.hand.root.position;
    const total = from.distanceTo(wrist);
    const length = total - SLEEVE_OVERLAP;
    if (length < 0.05) {
      this.mesh.visible = false;
      return;
    }
    this.#dir.subVectors(wrist, from).normalize();
    this.#end.copy(from).addScaledVector(this.#dir, length);
    this.mesh.visible = true;
    this.mesh.position.copy(from);
    this.mesh.quaternion.setFromUnitVectors(UP, this.#dir);
    this.mesh.scale.set(1, length, 1);
  }
}

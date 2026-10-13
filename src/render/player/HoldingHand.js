import { THREE } from '../../lib/three.js';
import { lookQuaternion } from './handMath.js';

/**
 * 左手：手のひらを上に向け、獲得したカードを載せる。
 * palmAnchor にカードを子として付けると手と一緒に動く。Updatable。
 */
export class HoldingHand {
  #quat = new THREE.Quaternion();
  #roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI + 0.42);
  #gazeTarget = new THREE.Vector3(-0.1, -0.33, -1.3);

  constructor({ camera, model, basePosition, scale = 0.9 }) {
    this.base = basePosition.clone();
    this.root = new THREE.Group();
    this.root.add(model);
    this.root.scale.setScalar(scale);

    this.palmAnchor = new THREE.Group();
    this.palmAnchor.position.set(0, -0.03, 0.058);
    this.palmAnchor.rotation.x = Math.PI / 2; // カードの面を手のひらに沿わせる
    this.root.add(this.palmAnchor);

    camera.add(this.root);
  }

  update(_dt, elapsed) {
    this.root.position.set(this.base.x, this.base.y + Math.sin(elapsed * 1.3 + 1) * 0.004, this.base.z);
    lookQuaternion(this.root.position, this.#gazeTarget, this.#quat).multiply(this.#roll);
    this.root.quaternion.copy(this.#quat);
  }
}

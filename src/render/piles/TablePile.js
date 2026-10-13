import { THREE } from '../../lib/three.js';

/**
 * テーブルの奥に表向きで積む置き場。Pile インターフェースを実装。
 */
export class TablePile {
  #count = 0;

  constructor({ scene, position, stackStep, random = Math.random }) {
    this.scene = scene;
    this.origin = position.clone();
    this.stackStep = stackStep;
    this.random = random;
  }

  nextSlot() {
    const i = this.#count++;
    const jitter = () => (this.random() - 0.5) * 0.05;
    return {
      parent: this.scene,
      position: new THREE.Vector3(this.origin.x + jitter(), this.origin.y + 0.004 + i * this.stackStep, this.origin.z + jitter()),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (this.random() - 0.5) * 0.4)),
      scale: 1
    };
  }
}

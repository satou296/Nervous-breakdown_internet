import { THREE } from '../../lib/three.js';

/**
 * 左手の上に重ねていく置き場。
 *
 * Pile インターフェース：
 *   nextSlot(): { parent, position, quaternion, scale }
 */
export class HandPile {
  #count = 0;

  constructor({ anchor, cardScale, stackStep, random = Math.random }) {
    this.anchor = anchor;
    this.cardScale = cardScale;
    this.stackStep = stackStep;
    this.random = random;
  }

  nextSlot() {
    const i = this.#count++;
    const jitter = () => (this.random() - 0.5) * 0.004;
    return {
      parent: this.anchor,
      position: new THREE.Vector3(jitter(), jitter(), i * this.stackStep + 0.002),
      quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (this.random() - 0.5) * 0.25),
      scale: this.cardScale
    };
  }
}

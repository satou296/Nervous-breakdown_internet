import { THREE } from '../../lib/three.js';

/**
 * めくったカードを置く姿勢を決める。
 * どちらもカメラの子として置くので、見回しても画面上の同じ場所に留まる。
 *   presentPose() … 画面中央に大きく
 *   dockPose(i)   … 画面下部（i 枚目の位置）に小さく
 */
export class RevealStage {
  #facingViewer = new THREE.Quaternion(); // カメラ空間で正面を向く

  constructor({ camera, layout }) {
    this.camera = camera;
    this.layout = layout;
  }

  presentPose() {
    return this.#pose(this.layout.present);
  }

  dockPose(slotIndex) {
    const docks = this.layout.docks;
    return this.#pose(docks[slotIndex % docks.length]);
  }

  #pose({ position, scale }) {
    return {
      parent: this.camera,
      position: new THREE.Vector3(...position),
      quaternion: this.#facingViewer.clone(),
      scale
    };
  }
}

import { THREE } from '../../lib/three.js';

/**
 * Canvas に描いた絵を three.js のテクスチャにする。
 * 何を描くかは painter 関数に任せる。
 */
export class CanvasTextureFactory {
  constructor(renderer) {
    this.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  create(width, height, paint, { repeat } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = this.anisotropy;
    if (repeat) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
    }
    return texture;
  }
}

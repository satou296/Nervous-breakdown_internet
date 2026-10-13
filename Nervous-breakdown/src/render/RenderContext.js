import { THREE } from '../lib/three.js';

/**
 * WebGL レンダラーとシーンを持ち、毎フレーム描画する。
 * GameLoop には最後に登録する（他の更新が終わった状態を描くため）。
 */
export class RenderContext {
  constructor(container, { background = 0x0e0a08, fog = [9, 24] } = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.scene.fog = new THREE.Fog(background, fog[0], fog[1]);
    this.camera = null;
  }

  get canvas() { return this.renderer.domElement; }

  setCamera(camera) {
    this.camera = camera;
  }

  setSize(width, height) {
    this.renderer.setSize(width, height);
  }

  update() {
    if (this.camera) this.renderer.render(this.scene, this.camera);
  }
}

import { THREE } from '../../lib/three.js';

/**
 * プレイヤーの目（カメラ）。見回し角度を制限付きで受け付け、なめらかに追従させる。
 * Updatable。
 */
export class FirstPersonRig {
  #yaw = 0;
  #pitch;
  #targetYaw = 0;
  #targetPitch;

  constructor({ scene, config }) {
    this.config = config;
    this.camera = new THREE.PerspectiveCamera(config.fov, 1, config.near, config.far);
    this.camera.position.set(...config.position);
    this.camera.rotation.order = 'YXZ';
    scene.add(this.camera);
    this.#pitch = this.#targetPitch = config.initialPitch;
  }

  /** ドラッグ量（ピクセル）で見回す */
  lookByPixels(dx, dy) {
    const s = this.config.dragSensitivity;
    this.#setTarget(this.#targetYaw - dx * s, this.#targetPitch - dy * s);
  }

  /** 角速度（-1〜1 の入力 × 秒）で見回す */
  turn(yawInput, pitchInput, dt) {
    const s = this.config.keySpeed * dt;
    this.#setTarget(this.#targetYaw + yawInput * s, this.#targetPitch + pitchInput * s);
  }

  setViewport(width, height) {
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.8 ? this.config.portraitFov : this.config.fov;
    this.camera.updateProjectionMatrix();
  }

  update(dt, elapsed) {
    const k = 1 - Math.exp(-dt * this.config.smoothing);
    this.#yaw += (this.#targetYaw - this.#yaw) * k;
    this.#pitch += (this.#targetPitch - this.#pitch) * k;
    const breathing = Math.sin(elapsed * 0.7) * 0.004;
    this.camera.rotation.set(this.#pitch + breathing, this.#yaw, 0);
    this.camera.updateMatrixWorld();
  }

  #setTarget(yaw, pitch) {
    const c = this.config;
    this.#targetYaw = THREE.MathUtils.clamp(yaw, -c.yawLimit, c.yawLimit);
    this.#targetPitch = THREE.MathUtils.clamp(pitch, c.pitchMin, c.pitchMax);
  }
}

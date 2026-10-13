/**
 * 矢印キーの入力をカメラの見回しに変換する。Updatable。
 */
export class KeyboardLookController {
  constructor({ keyboard, rig }) {
    this.keyboard = keyboard;
    this.rig = rig;
  }

  update(dt) {
    const { yaw, pitch } = this.keyboard.lookAxis;
    if (yaw || pitch) this.rig.turn(yaw, pitch, dt);
  }
}

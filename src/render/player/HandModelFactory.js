import { THREE } from '../../lib/three.js';
import { FINGER_SHAPES, THUMB_SHAPE } from './HandPoses.js';

/**
 * ポーズ定義から手と前腕の3Dモデルを組み立てる。
 * 座標系：指先が +Z、手のひらが -Y、親指が +X（右手）。左手は mirror=true で作る。
 */
export class HandModelFactory {
  constructor({
    skin = new THREE.MeshStandardMaterial({ color: 0xb97a58, roughness: 0.62 }),
    sleeve = new THREE.MeshStandardMaterial({ color: 0x28324a, roughness: 0.92 }),
    cuff = new THREE.MeshStandardMaterial({ color: 0x3a4766, roughness: 0.85 })
  } = {}) {
    this.materials = { skin, sleeve, cuff };
  }

  create(pose, { mirror = false } = {}) {
    const hand = new THREE.Group();
    hand.add(...this.#palm());
    FINGER_SHAPES.forEach((shape, i) => {
      const finger = this.#finger(shape.lengths, shape.radius, pose.fingers[i]);
      finger.position.set(shape.x, 0.002, 0.088);
      finger.rotation.y = pose.spread[i];
      hand.add(finger);
      if (i === 0) hand.userData.fingertip = finger.userData.tip; // 人差し指の先（当たり判定に使う）
    });
    hand.add(this.#thumb(pose.thumb));
    hand.userData.palm = this.#palmCenter();
    hand.add(hand.userData.palm);
    hand.add(...this.#forearm());
    if (mirror) hand.scale.x = -1;
    return hand;
  }

  /** 手のひらの中心（当たり判定に使う目印） */
  #palmCenter() {
    const marker = new THREE.Group();
    marker.position.set(0, -0.02, 0.05);
    return marker;
  }

  #ellipsoid(sx, sy, sz, material = this.materials.skin) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  }

  #capsule(radius, length) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), this.materials.skin);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = length / 2;
    return mesh;
  }

  #palm() {
    const palm = this.#ellipsoid(0.047, 0.018, 0.054);
    palm.position.z = 0.046;
    const heel = this.#ellipsoid(0.038, 0.02, 0.03);
    heel.position.set(0.004, -0.002, 0.008);
    return [palm, heel];
  }

  /** 関節ごとに Group を入れ子にして、曲げ角を付ける */
  #finger(lengths, radius, curls) {
    const root = new THREE.Group();
    let parent = root;
    lengths.forEach((length, i) => {
      const joint = new THREE.Group();
      joint.rotation.x = curls[i];
      joint.add(this.#capsule(radius * (1 - i * 0.08), length));
      const tip = new THREE.Group();
      tip.position.z = length;
      joint.add(tip);
      parent.add(joint);
      parent = tip;
    });
    root.userData.tip = parent;
    return root;
  }

  #thumb(thumbPose) {
    const thumb = this.#finger(THUMB_SHAPE.lengths, THUMB_SHAPE.radius, thumbPose.curls);
    thumb.position.set(...THUMB_SHAPE.position);
    thumb.rotation.y = thumbPose.yaw;
    thumb.rotation.z = thumbPose.roll;
    return thumb;
  }

  #forearm() {
    const { skin, sleeve, cuff } = this.materials;
    const wrist = this.#ellipsoid(0.036, 0.024, 0.03);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.043, 0.3, 20), skin);
    arm.rotation.x = Math.PI / 2;
    arm.position.z = -0.15;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, 10, 28), cuff);
    ring.position.z = -0.22;
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.064, 0.55, 24), sleeve);
    cloth.rotation.x = Math.PI / 2;
    cloth.position.z = -0.5;
    return [wrist, arm, ring, cloth];
  }
}

import { THREE } from '../../lib/three.js';

const HOVER_GLOW = new THREE.Color(0x5a3e10);
const AIM_GLOW = new THREE.Color(0x8a6a20);
const TOUCH_GLOW = new THREE.Color(0xb08a30);
/** 表を見せている間、照明の当たり方に関係なく札面が読めるよう自己発光させる強さ */
const FACE_SELF_LIGHT = new THREE.Color(0x5a5650);

/**
 * 1枚のカードの見た目。
 * 両面の板ポリゴンを持ち、「両面とも表」「両面とも裏」を切り替えられる。
 * 動き方は Behavior（State パターン）に委ね、どの Behavior を使うかは外（CardChoreographer）が決める。
 */
export class CardView {
  #behavior = null;
  #hoverTarget = 0;
  #aimed = false;
  #touched = false;
  #elapsed = 0;
  #faceUp = false;

  constructor({ card, textures, geometry, floatBehavior }) {
    this.card = card;
    this.textures = textures;
    this.floatBehavior = floatBehavior;
    this.hover = 0;

    this.materials = [0, 1].map(() => new THREE.MeshStandardMaterial({
      map: textures.back, roughness: 0.48, metalness: 0, alphaTest: 0.5, emissive: 0x000000
    }));
    const front = new THREE.Mesh(geometry, this.materials[0]);
    const back = new THREE.Mesh(geometry, this.materials[1]);
    front.position.z = 0.0025;
    back.position.z = -0.0025;
    back.rotation.y = Math.PI;
    this.meshes = [front, back];
    for (const mesh of this.meshes) {
      mesh.castShadow = true;
      mesh.userData.cardView = this;
    }
    this.object = new THREE.Group();
    this.object.add(front, back);
  }

  get isPickable() { return this.#behavior?.pickable === true; }

  /* ---- 見た目の面 ---- */
  showFaceOnBothSides() {
    const face = this.textures.face(this.card.rank, this.card.suit);
    this.#faceUp = true;
    this.materials.forEach(m => { m.map = face; m.emissiveMap = face; m.needsUpdate = true; });
  }

  showBackOnBothSides() {
    this.#faceUp = false;
    this.materials.forEach(m => { m.map = this.textures.back; m.emissiveMap = null; m.needsUpdate = true; });
  }

  /* ---- 動きの切り替え ---- */
  float({ fromRest = false } = {}) {
    this.#setBehavior(this.floatBehavior, { fromRest });
  }

  /** 任意の Behavior に切り替える */
  play(behavior) {
    this.#setBehavior(behavior);
  }

  /* ---- 腕との接触（浮遊中だけ効く） ---- */
  push(offset) {
    if (this.isPickable) this.floatBehavior.push(this, offset);
  }

  knock(impulse, spinKick) {
    if (this.isPickable) this.floatBehavior.knock(impulse, spinKick);
  }

  /** 手のひらで押さえる／離す */
  setHeld(held) {
    this.floatBehavior.setHeld(held);
  }

  /* ---- 強調表示 ---- */
  setHovered(hovered) { this.#hoverTarget = hovered ? 1 : 0; }
  setAimed(aimed) { this.#aimed = aimed; }
  /** 手のひらが触れている（左クリックでめくれる）ことを示す */
  setTouched(touched) { this.#touched = touched; }

  update(dt, elapsed) {
    this.#elapsed = elapsed;
    const target = this.isPickable ? this.#hoverTarget : 0;
    this.hover += (target - this.hover) * (1 - Math.exp(-dt * 12));
    this.#behavior?.update(this, dt, elapsed);
    this.#updateGlow();
  }

  dispose() {
    this.object.parent?.remove(this.object);
    this.materials.forEach(m => m.dispose());
  }

  #setBehavior(behavior, options) {
    this.#behavior = behavior;
    behavior.enter(this, options);
  }

  #updateGlow() {
    if (this.#faceUp) {
      for (const m of this.materials) m.emissive.copy(FACE_SELF_LIGHT);
      return;
    }
    let strength = 0;
    let color = HOVER_GLOW;
    if (this.isPickable) {
      if (this.#touched) {
        color = TOUCH_GLOW;
        strength = 0.85 + 0.15 * Math.sin(this.#elapsed * 6);
      } else if (this.#aimed) {
        color = AIM_GLOW;
        strength = 0.6 + 0.4 * Math.sin(this.#elapsed * 14);
      } else {
        strength = this.hover * 0.8;
      }
    }
    for (const m of this.materials) m.emissive.copy(color).multiplyScalar(strength);
  }
}

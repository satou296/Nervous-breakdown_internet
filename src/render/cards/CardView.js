import { THREE } from '../../lib/three.js';

const HOVER_GLOW = new THREE.Color(0x5a3e10);
const AIM_GLOW = new THREE.Color(0x8a6a20);
const TOUCH_GLOW = new THREE.Color(0xb08a30);
/** 表を見せている間、照明の当たり方に関係なく札面が読めるよう自己発光させる強さ */
const FACE_SELF_LIGHT = new THREE.Color(0x5a5650);

/**
 * 1枚のカードの見た目。
 * 本物のトランプと同じく、おもて面（+Z 側）に数字とマーク、うら面（-Z 側）に模様を持つ両面の板。
 * 中身をまだ知らないカード（オンラインでめくられる前）は、おもて面にも模様を貼っておく。
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

    // [0] おもて面（数字とマーク）, [1] うら面（模様）
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
    this.showBack();
  }

  get isPickable() { return this.#behavior?.pickable === true; }

  /* ---- 見た目の面 ---- */
  /** 表向きにする（おもて面を明るく見せる）。中身はこの時点で分かっている必要がある */
  showFace() {
    this.#faceUp = true;
    this.#paintSides();
  }

  /** 裏向きに戻す。うら面を見せて浮遊するので、おもて面は見えない向きに保たれる */
  showBack() {
    this.#faceUp = false;
    this.#paintSides();
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

  #paintSides() {
    const [front, back] = this.materials;
    const known = this.card.rank !== null && this.card.rank !== undefined;
    const face = known ? this.textures.face(this.card.rank, this.card.suit) : this.textures.back;
    front.map = face;
    front.emissiveMap = this.#faceUp ? face : null;
    back.map = this.textures.back;
    back.emissiveMap = null;
    front.needsUpdate = true;
    back.needsUpdate = true;
  }

  #setBehavior(behavior, options) {
    this.#behavior = behavior;
    behavior.enter(this, options);
  }

  #updateGlow() {
    if (this.#faceUp) {
      this.materials[0].emissive.copy(FACE_SELF_LIGHT);
      this.materials[1].emissive.setScalar(0);
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

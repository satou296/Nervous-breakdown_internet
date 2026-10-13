import { THREE } from '../../lib/three.js';

const COLORS = Object.freeze([0x6fc3ff, 0xff8a7a, 0x8be08b, 0xe0b0ff]);

/**
 * オンライン対戦で、他のプレイヤーが「どこを狙っているか」を見せる。Updatable。
 * 全員が同じ席から見ているので、人ごとに少しずらした位置から、狙っている点まで光の線を引く。
 * しばらく情報が届かない人は消す。
 */
export class RemotePlayers {
  #avatars = new Map();
  #origin = new THREE.Vector3();
  #tip = new THREE.Vector3();

  constructor({ scene, camera, staleMs = 1500, restDistance = 3.2, now = () => performance.now() }) {
    this.scene = scene;
    this.camera = camera;
    this.staleMs = staleMs;
    this.restDistance = restDistance;
    this.now = now;
  }

  /** 狙いの向き（ワールド座標の単位ベクトル）と腕の伸びを更新する */
  setPose(index, name, dir, reach, isActive) {
    const avatar = this.#avatars.get(index) ?? this.#create(index, name);
    avatar.dir.set(dir[0], dir[1], dir[2]).normalize();
    avatar.reach = reach;
    avatar.isActive = isActive;
    avatar.lastSeen = this.now();
  }

  /** 手番の人の線だけを明るくする */
  setActive(index) {
    this.#avatars.forEach((a, i) => { a.isActive = i === index; });
  }

  remove(index) {
    const avatar = this.#avatars.get(index);
    if (!avatar) return;
    this.scene.remove(avatar.group);
    avatar.dispose();
    this.#avatars.delete(index);
  }

  clear() {
    [...this.#avatars.keys()].forEach(i => this.remove(i));
  }

  update() {
    const t = this.now();
    for (const [index, a] of this.#avatars) {
      const visible = t - a.lastSeen < this.staleMs;
      a.group.visible = visible;
      if (!visible) continue;
      // 人ごとに、自分の目の位置から少し左右・下にずらしたところを根元にする
      this.#origin.set(-0.45 + 0.3 * index, -0.32, -0.2);
      this.camera.localToWorld(this.#origin);
      const distance = a.reach > 0.05 ? a.reach + 0.3 : this.restDistance;
      this.#tip.copy(this.camera.position).addScaledVector(a.dir, distance);
      a.setEnds(this.#origin, this.#tip);
      a.setEmphasis(a.isActive ? 1 : 0.35);
    }
  }

  #create(index, name) {
    const color = COLORS[index % COLORS.length];
    const group = new THREE.Group();

    const lineGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.frustumCulled = false;

    const dotMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), dotMaterial);

    const label = this.#label(name, color);
    group.add(line, dot, label);
    this.scene.add(group);

    const avatar = {
      group, dir: new THREE.Vector3(0, 0, -1), reach: 0, isActive: false, lastSeen: 0,
      setEnds: (from, to) => {
        const pos = lineGeometry.attributes.position;
        pos.setXYZ(0, from.x, from.y, from.z);
        pos.setXYZ(1, to.x, to.y, to.z);
        pos.needsUpdate = true;
        dot.position.copy(to);
        label.position.copy(to).add(new THREE.Vector3(0, 0.22, 0));
      },
      setEmphasis: k => {
        lineMaterial.opacity = 0.25 + 0.5 * k;
        dotMaterial.opacity = 0.4 + 0.6 * k;
        label.material.opacity = 0.5 + 0.5 * k;
      },
      dispose: () => {
        lineGeometry.dispose(); lineMaterial.dispose(); dot.geometry.dispose(); dotMaterial.dispose();
        label.material.map.dispose(); label.material.dispose();
      }
    };
    this.#avatars.set(index, avatar);
    return avatar;
  }

  /** 名前の札（いつもこちらを向く板） */
  #label(name, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(14,10,8,.75)';
    ctx.beginPath(); ctx.roundRect?.(4, 8, 248, 48, 24); ctx.fill();
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.font = '700 28px "Zen Kaku Gothic New", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 33, 230);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(0.8, 0.2, 1);
    return sprite;
  }
}

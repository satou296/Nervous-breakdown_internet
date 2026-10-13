/**
 * 腕を伸ばすほど、右手と伸びた袖を透かす。Updatable。
 * 伸ばした腕が狙っているカードや周りのカードを隠さないようにするため。
 */
export class ArmVisibility {
  #lastOpacity = -1;

  /**
   * @param {object} p
   * @param {{ reach: number }} p.hand        いまの伸び（メートル）を持つもの
   * @param {THREE.Material[]} p.materials    透かす対象（右手・袖の材質）
   */
  constructor({ hand, materials, minOpacity, fadeOverReach }) {
    this.hand = hand;
    this.materials = materials;
    this.minOpacity = minOpacity;
    this.fadeOverReach = fadeOverReach;
    for (const m of materials) m.transparent = true;
  }

  update() {
    const t = Math.min(1, this.hand.reach / this.fadeOverReach);
    const opacity = Math.round((1 - (1 - this.minOpacity) * t) * 100) / 100;
    if (opacity === this.#lastOpacity) return;
    this.#lastOpacity = opacity;
    for (const m of this.materials) m.opacity = opacity;
  }
}

/**
 * カードのテクスチャを生成・キャッシュする。
 * 表面はランク×スートごとに一度だけ描き、裏面は全カードで共有する。
 */
export class CardTextureLibrary {
  #faces = new Map();
  #back = null;

  constructor({ textureFactory, facePainter, backPainter, width, height }) {
    this.textureFactory = textureFactory;
    this.facePainter = facePainter;
    this.backPainter = backPainter;
    this.width = width;
    this.height = height;
  }

  face(rank, suit) {
    const key = `${rank}-${suit}`;
    if (!this.#faces.has(key)) {
      this.#faces.set(key, this.textureFactory.create(this.width, this.height,
        ctx => this.facePainter.paint(ctx, rank, suit)));
    }
    return this.#faces.get(key);
  }

  get back() {
    if (!this.#back) {
      this.#back = this.textureFactory.create(this.width, this.height, ctx => this.backPainter.paint(ctx));
    }
    return this.#back;
  }

  /** フォント読み込み後などに表面を描き直したいときに呼ぶ */
  invalidateFaces() {
    this.#faces.forEach(t => t.dispose());
    this.#faces.clear();
  }
}

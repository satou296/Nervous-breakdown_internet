/**
 * ウィンドウの大きさの変化を、描画サイズとカメラに伝える。
 */
export class ViewportBinder {
  constructor({ renderContext, rig, target = window }) {
    this.renderContext = renderContext;
    this.rig = rig;
    this.target = target;
  }

  bind() {
    const apply = () => {
      const { innerWidth: w, innerHeight: h } = this.target;
      this.renderContext.setSize(w, h);
      this.rig.setViewport(w, h);
    };
    this.target.addEventListener('resize', apply);
    apply();
  }
}

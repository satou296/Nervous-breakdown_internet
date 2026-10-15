/**
 * 動かない：定位置からずれない（チュートリアル用。その場で回るだけ）。DriftPattern を実装。
 */
export class StillDrift {
  offsetAt(_t, out) {
    return out.set(0, 0, 0);
  }
}

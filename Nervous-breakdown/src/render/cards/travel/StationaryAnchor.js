/**
 * 定位置は動かない（ふつう〜達人）。
 *
 * AnchorTravel インターフェース：
 *   step(anchor: {x,y,z}, dt): void  … 定位置そのものを動かす
 */
export class StationaryAnchor {
  step() {}
}

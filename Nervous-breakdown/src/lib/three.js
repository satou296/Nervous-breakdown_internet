/**
 * three.js への唯一の依存点。
 * 他のモジュールは window.THREE を直接参照せず、必ずここから import する。
 * （ライブラリの読み込み方法を変える場合はこのファイルだけを直せばよい）
 */
const THREE = window.THREE;
if (!THREE) {
  throw new Error('three.js が読み込まれていません。index.html の <script> を確認してください。');
}
export { THREE };

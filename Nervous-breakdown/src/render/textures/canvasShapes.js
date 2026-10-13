/** Canvas 2D で角丸長方形のパスを作る */
export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 180°回転した座標系で描画する（トランプの上下対称デザイン用） */
export function withHalfTurn(ctx, width, height, draw) {
  ctx.save();
  ctx.translate(width, height);
  ctx.rotate(Math.PI);
  draw();
  ctx.restore();
}

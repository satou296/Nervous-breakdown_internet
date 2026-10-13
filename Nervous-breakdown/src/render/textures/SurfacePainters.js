/**
 * 部屋の素材（床板・フェルト）を描く painter 関数群。
 */
export function paintWoodPlanks(ctx, w, h, random = Math.random) {
  const planks = 8;
  const plankH = h / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = `hsl(22,42%,${16 + random() * 8}%)`;
    ctx.fillRect(0, i * plankH, w, plankH);
    for (let k = 0; k < 40; k++) {
      ctx.strokeStyle = `rgba(0,0,0,${random() * 0.12})`;
      ctx.beginPath();
      const y = i * plankH + random() * plankH;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + random() * 3);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, i * plankH, w, 2);
  }
}

export function paintFelt(ctx, w, h, random = Math.random) {
  ctx.fillStyle = '#1d5a40';
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (random() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

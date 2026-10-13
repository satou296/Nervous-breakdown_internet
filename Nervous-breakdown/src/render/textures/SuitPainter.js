import { Suit } from '../../domain/Suit.js';

const TAU = Math.PI * 2;

function heartPath(ctx, s, sy) {
  ctx.moveTo(0, 0.45 * s * sy);
  ctx.bezierCurveTo(-0.62 * s, 0.02 * s * sy, -0.42 * s, -0.52 * s * sy, 0, -0.2 * s * sy);
  ctx.bezierCurveTo(0.42 * s, -0.52 * s * sy, 0.62 * s, 0.02 * s * sy, 0, 0.45 * s * sy);
}

/** スートごとのパス生成器（中心原点・高さ約 s） */
const SUIT_PATHS = {
  [Suit.Spade](ctx, s) {
    ctx.save(); ctx.translate(0, -0.08 * s); heartPath(ctx, s * 0.95, -1); ctx.restore();
    ctx.moveTo(0, 0.02 * s); ctx.lineTo(-0.17 * s, 0.5 * s); ctx.lineTo(0.17 * s, 0.5 * s); ctx.closePath();
  },
  [Suit.Heart](ctx, s) {
    ctx.save(); ctx.translate(0, 0.02 * s); heartPath(ctx, s, 1); ctx.restore();
  },
  [Suit.Diamond](ctx, s) {
    ctx.moveTo(0, -0.5 * s); ctx.lineTo(0.36 * s, 0); ctx.lineTo(0, 0.5 * s); ctx.lineTo(-0.36 * s, 0); ctx.closePath();
  },
  [Suit.Club](ctx, s) {
    const lobes = [[0, -0.22, 0.21], [-0.23, 0.07, 0.21], [0.23, 0.07, 0.21], [0, 0, 0.12]];
    for (const [cx, cy, r] of lobes) {
      ctx.moveTo(cx * s + r * s, cy * s);
      ctx.arc(cx * s, cy * s, r * s, 0, TAU);
    }
    ctx.moveTo(0, 0); ctx.lineTo(-0.16 * s, 0.5 * s); ctx.lineTo(0.16 * s, 0.5 * s); ctx.closePath();
  }
};

/**
 * スート記号をフォントに頼らずパスで描く（どの環境でも同じ形になる）。
 */
export class SuitPainter {
  draw(ctx, suit, x, y, size, upsideDown = false) {
    const pathOf = SUIT_PATHS[suit];
    if (!pathOf) throw new Error(`未知のスート: ${suit}`);
    ctx.save();
    ctx.translate(x, y);
    if (upsideDown) ctx.rotate(Math.PI);
    ctx.beginPath();
    pathOf(ctx, size);
    ctx.fill();
    ctx.restore();
  }
}

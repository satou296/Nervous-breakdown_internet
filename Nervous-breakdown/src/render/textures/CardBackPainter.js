import { Suit } from '../../domain/Suit.js';
import { roundRectPath } from './canvasShapes.js';

const TAU = Math.PI * 2;
const PALETTE = Object.freeze({
  paper: '#fbf7ee', field: '#7a1f2b', lattice: 'rgba(240,215,170,.32)', gold: '#e9cf98'
});

/**
 * カードの裏面（えんじ色の格子柄＋中央のメダリオン）を描く。
 */
export class CardBackPainter {
  constructor({ suitPainter, width, height }) {
    this.suits = suitPainter;
    this.width = width;
    this.height = height;
  }

  paint(ctx) {
    const { width: W, height: H } = this;
    roundRectPath(ctx, 4, 4, W - 8, H - 8, 26);
    ctx.fillStyle = PALETTE.paper;
    ctx.fill();

    ctx.save();
    roundRectPath(ctx, 18, 18, W - 36, H - 36, 16);
    ctx.fillStyle = PALETTE.field;
    ctx.fill();
    ctx.clip();
    this.#paintLattice(ctx);
    ctx.restore();

    roundRectPath(ctx, 30, 30, W - 60, H - 60, 10);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    this.#paintMedallion(ctx);
  }

  #paintLattice(ctx) {
    const { width: W, height: H } = this;
    ctx.strokeStyle = PALETTE.lattice;
    ctx.lineWidth = 2;
    for (let i = -H; i < W + H; i += 22) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke();
    }
  }

  #paintMedallion(ctx) {
    const cx = this.width / 2, cy = this.height / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, 58, 76, 0, 0, TAU);
    ctx.fillStyle = PALETTE.field; ctx.fill();
    ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, 48, 66, 0, 0, TAU);
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    this.suits.draw(ctx, Suit.Spade, cx, cy - 26, 30);
    this.suits.draw(ctx, Suit.Heart, cx, cy + 26, 30, true);
    this.suits.draw(ctx, Suit.Diamond, cx - 26, cy, 24);
    this.suits.draw(ctx, Suit.Club, cx + 26, cy, 24);
  }
}

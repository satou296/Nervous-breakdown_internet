import { rankLabel, isRedSuit, Suit } from '../../domain/Suit.js';
import { PIP_LAYOUTS } from './PipLayouts.js';
import { roundRectPath, withHalfTurn } from './canvasShapes.js';

const TAU = Math.PI * 2;
const PALETTE = Object.freeze({
  paper: '#fbf7ee', edge: '#cfc6b4', red: '#b3202c', black: '#1b1d24',
  gold: '#c79a3e', courtRed: '#f4e2d6', courtBlack: '#e6e4ea'
});
const DISPLAY_FONT = '"Shippori Mincho B1", Georgia, serif';

/**
 * カードの表面を描く。札の種類（エース／数札／絵札）ごとに描き方を分ける。
 */
export class CardFacePainter {
  constructor({ suitPainter, width, height }) {
    this.suits = suitPainter;
    this.width = width;
    this.height = height;
  }

  paint(ctx, rank, suit) {
    const color = isRedSuit(suit) ? PALETTE.red : PALETTE.black;
    this.#paintPaper(ctx);
    ctx.fillStyle = color;
    this.#paintIndices(ctx, rank, suit);
    if (rank === 1) this.#paintAce(ctx, suit, color);
    else if (rank <= 10) this.#paintPips(ctx, rank, suit);
    else this.#paintCourt(ctx, rank, suit, color);
  }

  #paintPaper(ctx) {
    roundRectPath(ctx, 4, 4, this.width - 8, this.height - 8, 26);
    ctx.fillStyle = PALETTE.paper;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.edge;
    ctx.stroke();
  }

  /** 左上と右下（逆さ）の数字とスート */
  #paintIndices(ctx, rank, suit) {
    const label = rankLabel(rank);
    const draw = () => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `800 52px ${DISPLAY_FONT}`;
      ctx.save();
      ctx.translate(38, 66);
      if (label.length > 1) ctx.scale(0.72, 1);
      ctx.fillText(label, 0, 0);
      ctx.restore();
      this.suits.draw(ctx, suit, 38, 96, 32);
    };
    draw();
    withHalfTurn(ctx, this.width, this.height, draw);
  }

  #paintAce(ctx, suit, color) {
    const cx = this.width / 2, cy = this.height / 2;
    const isSpade = suit === Suit.Spade;
    if (isSpade) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 96, 112, 0, 0, TAU);
      ctx.stroke();
    }
    this.suits.draw(ctx, suit, cx, cy, isSpade ? 168 : 140);
  }

  #paintPips(ctx, rank, suit) {
    const size = rank === 10 ? 50 : 56;
    for (const [px, py] of PIP_LAYOUTS[rank]) {
      this.suits.draw(ctx, suit, px * this.width, this.height * (0.08 + py * 0.84), size, py > 0.5);
    }
  }

  /** 絵札：枠の中に大きな文字とスート（上下対称） */
  #paintCourt(ctx, rank, suit, color) {
    const { width: W, height: H } = this;
    const fx = 66, fy = 112, fw = W - 132, fh = H - 224;
    roundRectPath(ctx, fx, fy, fw, fh, 8);
    ctx.fillStyle = isRedSuit(suit) ? PALETTE.courtRed : PALETTE.courtBlack;
    ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.gold; ctx.stroke();
    roundRectPath(ctx, fx + 7, fy + 7, fw - 14, fh - 14, 5);
    ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx + 7, H / 2); ctx.lineTo(fx + fw - 7, H / 2);
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 2; ctx.stroke();

    const half = () => {
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.font = `800 92px ${DISPLAY_FONT}`;
      ctx.fillText(rankLabel(rank), W / 2 - 14, H / 2 - 22);
      this.suits.draw(ctx, suit, W / 2 + 44, H / 2 - 74, 36);
      ctx.fillStyle = PALETTE.gold;
      this.suits.draw(ctx, Suit.Diamond, W / 2 + 44, H / 2 - 30, 14);
    };
    half();
    withHalfTurn(ctx, W, H, half);
  }
}

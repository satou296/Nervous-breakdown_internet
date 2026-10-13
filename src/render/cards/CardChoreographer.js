import { SequenceBehavior } from './behaviors/SequenceBehavior.js';
import { PoseTween, Wait, Easing } from './behaviors/PoseTween.js';

/**
 * カードの演出の振り付け。
 * 「めくる」「取る」「宙に戻す」をどんな手順で見せるかをここに集め、CardView には手順だけを渡す。
 */
export class CardChoreographer {
  constructor({ stage, motion }) {
    this.stage = stage;
    this.motion = motion;
  }

  /** 両面を表にして、中央に大きく見せてから画面下部の slot 番目へ寄せる */
  reveal(view, slotIndex) {
    const r = this.motion.reveal;
    view.showFaceOnBothSides();
    view.play(new SequenceBehavior([
      new PoseTween({
        pose: this.stage.presentPose(),
        durationSec: r.presentSec,
        spinTurns: r.spinTurns,
        arcHeight: r.arcHeight
      }),
      new Wait(r.holdSec),
      new PoseTween({ pose: this.stage.dockPose(slotIndex), durationSec: r.dockSec, ease: Easing.inOutCubic })
    ]));
  }

  /** 取ったプレイヤーの置き場へ運ぶ */
  collect(view, pileSlot) {
    view.play(new SequenceBehavior([
      new PoseTween({ pose: pileSlot, durationSec: this.motion.collectSec, ease: Easing.inOutCubic })
    ]));
  }

  /** 両面を裏に戻して、ふたたび宙を漂わせる */
  returnToAir(view) {
    view.showBackOnBothSides();
    view.float({ fromRest: true });
  }

  /** 表示しきるまでの合計時間（ミリ秒）。この間は次のカードを選ばせない */
  get revealDurationMs() {
    const r = this.motion.reveal;
    return (r.presentSec + r.holdSec + r.dockSec) * 1000;
  }
}

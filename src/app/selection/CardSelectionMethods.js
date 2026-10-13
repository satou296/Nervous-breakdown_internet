/**
 * カードの選び方（Strategy）。難易度の interaction で使い分ける。
 * どちらも「左クリック（タップ）したときに、どのカードを選ぶか」を答える。
 *
 * interface CardSelectionMethod {
 *   cardFromTap(ndc): Card | null
 *   usesReach: boolean     … 腕を伸ばす操作を使うか
 *   usesHover: boolean     … カーソルを合わせたカードを光らせるか
 * }
 */

/** カーソルを合わせたカードを、左クリックで選ぶ */
export class PointSelection {
  usesReach = false;
  usesHover = true;

  constructor({ picker }) {
    this.picker = picker;
  }

  cardFromTap(ndc) {
    return this.picker.pick(ndc)?.card ?? null;
  }
}

/** 腕を伸ばし、手のひらが触れているカードを、左クリックで選ぶ */
export class ReachSelection {
  usesReach = true;
  usesHover = false;

  constructor({ contactSensor }) {
    this.contactSensor = contactSensor;
  }

  cardFromTap() {
    return this.contactSensor.current?.card ?? null;
  }
}

/** interaction 名から選び方を作る。register() で追加できる */
export class CardSelectionFactory {
  #creators = new Map();

  constructor({ picker, contactSensor }) {
    this.register('point', () => new PointSelection({ picker }));
    this.register('reach', () => new ReachSelection({ contactSensor }));
  }

  register(interaction, creator) {
    this.#creators.set(interaction, creator);
  }

  create(interaction) {
    const creator = this.#creators.get(interaction);
    if (!creator) throw new Error(`未知の選び方です: ${interaction}`);
    return creator();
  }
}

/**
 * 手のひらが触れているカードを、プレイヤーに知らせる。Updatable。
 * 触れているカードを光らせ、画面に「左クリックでめくる」を出す。
 * めくれる状態のとき（isActive が true）だけ知らせる。
 */
export class ContactFeedback {
  #shown = null;

  constructor({ sensor, indicator, isActive }) {
    this.sensor = sensor;
    this.indicator = indicator;
    this.isActive = isActive;
  }

  update() {
    const view = this.isActive() ? this.sensor.current : null;
    if (view === this.#shown) return;
    this.#shown?.setTouched(false);
    view?.setTouched(true);
    this.#shown = view;
    if (view) this.indicator.show();
    else this.indicator.hide();
  }
}

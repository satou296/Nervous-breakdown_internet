/**
 * 手のひらが触れているカードを押さえて、その場に止める。Updatable。
 * 触れている間に漂って離れてしまい、クリックが空振りするのを防ぐ。
 * isEnabled が false のとき（極など）は押さえない。触れていても動き続ける。
 */
export class PalmHold {
  #held = null;

  constructor({ sensor, isEnabled = () => true }) {
    this.sensor = sensor;
    this.isEnabled = isEnabled;
  }

  update() {
    const view = this.isEnabled() ? this.sensor.current : null;
    if (view === this.#held) return;
    this.#held?.setHeld(false);
    view?.setHeld(true);
    this.#held = view;
  }
}

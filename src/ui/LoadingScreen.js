/** 起動中の表示 */
export class LoadingScreen {
  constructor(element) {
    this.element = element;
  }

  hide() {
    this.element.hidden = true;
  }
}

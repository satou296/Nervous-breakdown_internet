export const PlayerKind = Object.freeze({
  Human: 'human',
  Cpu: 'cpu'
});

/**
 * プレイヤー。名前・種類・獲得ペア数だけを持つ。
 */
export class Player {
  #pairs = 0;

  constructor({ name, kind = PlayerKind.Human }) {
    this.name = name;
    this.kind = kind;
  }

  get pairs() { return this.#pairs; }
  get isCpu() { return this.kind === PlayerKind.Cpu; }

  awardPair() {
    this.#pairs++;
  }
}

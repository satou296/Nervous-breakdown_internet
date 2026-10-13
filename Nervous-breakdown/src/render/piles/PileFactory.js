import { THREE } from '../../lib/three.js';
import { HandPile } from './HandPile.js';
import { TablePile } from './TablePile.js';

/**
 * 置き場の種類名（'hand' / 'table' …）から Pile を作る。
 * register() で新しい種類を追加できる（Open/Closed）。
 */
export class PileFactory {
  #creators = new Map();

  constructor({ scene, holdingHand, piles, table }) {
    this.register('hand', () => new HandPile({
      anchor: holdingHand.palmAnchor,
      cardScale: piles.handCardScale,
      stackStep: piles.handStackStep
    }));
    this.register('table', (seatIndex) => new TablePile({
      scene,
      position: new THREE.Vector3(
        piles.table.x + Math.max(0, seatIndex - 1) * piles.table.seatSpacingX,
        table.top,
        piles.table.z
      ),
      stackStep: piles.table.stackStep
    }));
  }

  register(type, creator) {
    this.#creators.set(type, creator);
  }

  create(type, seatIndex) {
    const creator = this.#creators.get(type);
    if (!creator) throw new Error(`未知の置き場の種類です: ${type}`);
    return creator(seatIndex);
  }
}

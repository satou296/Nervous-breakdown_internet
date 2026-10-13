import { THREE } from '../lib/three.js';
import { ndcToCameraDirection } from '../render/player/handMath.js';
import { ClientMessage } from '../net/Protocol.js';

/**
 * 自分が狙っている向き（カーソルの先）と腕の伸びを、一定間隔でサーバーへ送る。
 * 他の人の画面では RemotePlayers がこれを線で表示する。
 */
export class PresenceBroadcaster {
  #sinceLast = 0;
  #dir = new THREE.Vector3();

  constructor({ network, camera, pointer, reach, intervalMs = 80 }) {
    this.network = network;
    this.camera = camera;
    this.pointer = pointer;
    this.reach = reach;
    this.intervalMs = intervalMs;
  }

  tick(dt) {
    this.#sinceLast += dt * 1000;
    if (this.#sinceLast < this.intervalMs) return;
    this.#sinceLast = 0;
    ndcToCameraDirection(this.pointer.ndc, this.camera, this.#dir).applyQuaternion(this.camera.quaternion);
    const round = n => Math.round(n * 1000) / 1000;
    this.network.send(ClientMessage.Presence, {
      dir: [round(this.#dir.x), round(this.#dir.y), round(this.#dir.z)],
      reach: round(this.reach.length)
    });
  }
}

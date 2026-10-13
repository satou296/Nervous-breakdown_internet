import { THREE } from '../../lib/three.js';

/**
 * 部屋の照明：テーブル真上のスポット、壁のランプ、手元を照らす補助光。
 */
export class Lighting {
  constructor({ scene, camera, table }) {
    scene.add(new THREE.HemisphereLight(0xffe2c0, 0x1a1210, 0.42));
    this.#addTableSpot(scene, table);
    this.#addWallLamps(scene, [-6.5, 6.5]);
    this.#addHandFill(camera);
  }

  #addTableSpot(scene, table) {
    const spot = new THREE.SpotLight(0xffdcae, 2.3, 22, 0.66, 0.55, 1);
    spot.position.set(0, 6.6, table.z + 0.6);
    spot.target.position.set(0, table.top, table.z);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    scene.add(spot, spot.target);
  }

  #addWallLamps(scene, xs) {
    const bulbGeometry = new THREE.SphereGeometry(0.12, 16, 12);
    const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffc27a });
    for (const x of xs) {
      const light = new THREE.PointLight(0xff9a4a, 0.75, 11, 1);
      light.position.set(x, 2.7, -6);
      const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
      bulb.position.copy(light.position);
      scene.add(light, bulb);
    }
  }

  #addHandFill(camera) {
    const fill = new THREE.PointLight(0xffe6cc, 0.18, 1.6, 1);
    fill.position.set(0.1, 0.45, 0.1);
    camera.add(fill);
  }
}

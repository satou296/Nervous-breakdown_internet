import { THREE } from '../../lib/three.js';
import { paintFelt } from '../textures/SurfacePainters.js';

/**
 * 緑のフェルトを張った丸テーブル。
 */
export class CasinoTable {
  constructor({ scene, textureFactory, table }) {
    const { z, top, radius } = table;
    const group = new THREE.Group();
    group.position.set(0, 0, z);

    const felt = textureFactory.create(256, 256, paintFelt, { repeat: [5, 5] });
    const surface = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.06, 96),
      new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 })
    );
    surface.position.y = top - 0.03;
    surface.receiveShadow = true;

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.02, 0.11, 16, 120),
      new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.42 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = top;
    rim.castShadow = rim.receiveShadow = true;

    const brassLine = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.7, radius - 0.66, 128),
      new THREE.MeshStandardMaterial({ color: 0xd8b46a, roughness: 0.4, metalness: 0.6 })
    );
    brassLine.rotation.x = -Math.PI / 2;
    brassLine.position.y = top + 0.002;

    const pedestalHeight = top - 0.06;
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.9, pedestalHeight, 32),
      new THREE.MeshStandardMaterial({ color: 0x2b1910, roughness: 0.6 })
    );
    pedestal.position.y = pedestalHeight / 2;
    pedestal.castShadow = true;

    group.add(surface, rim, brassLine, pedestal);
    scene.add(group);
  }
}

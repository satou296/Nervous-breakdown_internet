import { THREE } from '../../lib/three.js';
import { paintWoodPlanks } from '../textures/SurfacePainters.js';

/**
 * 床と円筒状の壁。
 */
export class Room {
  constructor({ scene, textureFactory }) {
    const wood = textureFactory.create(512, 512, paintWoodPlanks, { repeat: [6, 6] });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.75 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 15, 10, 48, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.95, side: THREE.BackSide })
    );
    wall.position.y = 5;

    scene.add(floor, wall);
  }
}

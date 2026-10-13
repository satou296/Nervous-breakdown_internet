import { THREE } from '../../lib/three.js';

/**
 * ランプの光に漂うほこり。Updatable。
 */
export class DustParticles {
  constructor({ scene, count = 260, height = 5, random = Math.random }) {
    this.count = count;
    this.height = height;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * 9;
      positions[i * 3 + 1] = random() * height;
      positions[i * 3 + 2] = -1 - random() * 8;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffd9a0, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false
    });
    scene.add(new THREE.Points(this.geometry, material));
  }

  update(dt, elapsed) {
    const attr = this.geometry.attributes.position;
    for (let i = 0; i < this.count; i++) {
      let y = attr.getY(i) + dt * 0.04;
      if (y > this.height) y = 0;
      attr.setY(i, y);
      attr.setX(i, attr.getX(i) + Math.sin(elapsed * 0.3 + i) * dt * 0.01);
    }
    attr.needsUpdate = true;
  }
}

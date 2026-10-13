import { THREE } from '../../lib/three.js';

const UP = new THREE.Vector3(0, 1, 0);
const matrix = new THREE.Matrix4();

/** from から to を向く（+Z が to を指す）回転を out に書き込む */
export function lookQuaternion(from, to, out) {
  matrix.lookAt(to, from, UP);
  return out.setFromRotationMatrix(matrix);
}

/** 画面座標（NDC）をカメラ空間の視線方向に変換する */
export function ndcToCameraDirection(ndc, camera, out) {
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return out.set(ndc.x * tanHalfFov * camera.aspect, ndc.y * tanHalfFov, -1).normalize();
}

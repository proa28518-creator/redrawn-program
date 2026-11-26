// view.js: the camera as the head sees it. viewOf() is the inverse of bench.html place(): for any THREE camera and a head's world
// transform it returns the same { cx, cy, d, roll, az, el } fields place() takes, so every part keeps reading ctx.cam as today.
//   az = atan2(dir.x, dir.z), el = asin(dir.y), dir = camera position in the head's frame (normalised)
//   ray = head centre in camera space; d = F / (sqrt(D^2 - .25) * cos^1.5), cos = -ray.z   (place(): D = hypot(F / (d cos^1.5), .5))
//   roll = signed angle about dir from y0 = dir x x0 (x0 = up x dir) to B0's Y, B0 = q(camera in head frame) * Q^-1, Q = ray -> -Z
// headWorld: Matrix4 of the head (rotation + translation, unit scale: 1 D = 1 world unit). V is written in place, nothing allocated.
import * as THREE from './three.js';

const DEG = 180 / Math.PI;
const _hp = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hs = new THREE.Vector3(), _hqi = new THREE.Quaternion();
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cs = new THREE.Vector3();
const _dir = new THREE.Vector3(), _ray = new THREE.Vector3(), _qc = new THREE.Quaternion(), _Q = new THREE.Quaternion(), _negZ = new THREE.Vector3(0, 0, -1);
const _up = new THREE.Vector3(), _x0 = new THREE.Vector3(), _y0 = new THREE.Vector3(), _yR = new THREE.Vector3(), _c = new THREE.Vector3();

export function focalOf(camera, H) { return (H / 2) / Math.tan(camera.fov * Math.PI / 360); }

export function viewOf(V, headWorld, camera, W, H) {
  camera.updateMatrixWorld();
  headWorld.decompose(_hp, _hq, _hs);
  camera.matrixWorld.decompose(_cp, _cq, _cs);
  _hqi.copy(_hq).invert();
  const F = focalOf(camera, H);
  // camera in the head's frame
  _dir.copy(_cp).sub(_hp).applyQuaternion(_hqi);
  const D = _dir.length(); _dir.divideScalar(D);
  _qc.copy(_hqi).multiply(_cq);
  // head centre in camera space
  _ray.copy(_hp).sub(_cp).applyQuaternion(_cq.clone().invert());
  const depth = -_ray.z;
  _ray.normalize();
  const cos = -_ray.z;
  V.cx = W / 2 + F * _ray.x / cos;
  V.cy = H / 2 - F * _ray.y / cos;
  V.d = F / (Math.sqrt(Math.max(D * D - .25, 1e-6)) * Math.pow(Math.max(cos, 1e-6), 1.5));
  V.az = Math.atan2(_dir.x, _dir.z) * DEG;
  V.el = Math.asin(Math.max(-1, Math.min(1, _dir.y))) * DEG;
  // roll
  _Q.setFromUnitVectors(_ray, _negZ);
  _qc.multiply(_Q.invert()); // B0
  _yR.set(0, 1, 0).applyQuaternion(_qc);
  if (Math.abs(_dir.y) > .999) _up.set(0, 0, -Math.sign(_dir.y)); else _up.set(0, 1, 0);
  _x0.crossVectors(_up, _dir).normalize(); _y0.crossVectors(_dir, _x0);
  _c.crossVectors(_y0, _yR);
  V.roll = Math.atan2(_c.dot(_dir), _y0.dot(_yR)) * DEG;
  V.distance = D; V.depth = depth; V.focal = F; V.width = W; V.height = H;
  V.side = V.az >= 0 ? 1 : -1;
  return V;
}

// Bench place() as a function of a camera (for tests and for keying a camera by screen terms). Head at headWorld (default origin).
export function place(camera, { cx, cy, d, roll = 0, az = 0, el = 0 }, W, H) {
  const R = Math.PI / 180, F = focalOf(camera, H);
  const dir = new THREE.Vector3(Math.sin(az * R) * Math.cos(el * R), Math.sin(el * R), Math.cos(az * R) * Math.cos(el * R));
  const ray = new THREE.Vector3((cx - W / 2) / F, -(cy - H / 2) / F, -1).normalize();
  const cos = -ray.z;
  const D = Math.hypot(F / (d * Math.pow(cos, 1.5)), .5);
  const near = Math.abs(dir.y) > .999 ? new THREE.Vector3(0, 0, -Math.sign(dir.y)) : new THREE.Vector3(0, 1, 0);
  const x0 = new THREE.Vector3().crossVectors(near, dir).normalize(), y0 = new THREE.Vector3().crossVectors(dir, x0);
  const yR = y0.clone().applyAxisAngle(dir, roll * R), xR = x0.clone().applyAxisAngle(dir, roll * R);
  const B0 = new THREE.Matrix4().makeBasis(xR, yR, dir);
  const Q = new THREE.Quaternion().setFromUnitVectors(ray, new THREE.Vector3(0, 0, -1));
  camera.position.copy(dir).multiplyScalar(D);
  camera.quaternion.setFromRotationMatrix(B0).multiply(Q);
  camera.updateMatrixWorld(true);
  return D;
}

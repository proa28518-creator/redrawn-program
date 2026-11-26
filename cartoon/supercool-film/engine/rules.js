// rules.js: the 2.5D layer rules, live from V = viewOf(head) (docs/ENGINE_DESIGN.md section 2). Every per-frame record the parts used to read
// from a track is computed here from the view + the pose. Constants in RULES (one object) so they can be re-tuned without touching code.
import * as THREE from './three.js';

export const RULES = {
  // clamp 80 (F2, 2026-11-04): at 62 the -az side (gain .83) hit the clamp at az -75 and the face then rode the head to the rim (a 20 px
  // jump by az -90 in the turnaround); the gains alone keep it under 62 for every |az| <= 75 he shows, and stay continuous up to offAz
  face: { yawNeg: .83, yawPos: .68, clamp: 80, pitch: -1, pitchBase: 0, roll: 0, flipAz: 2, offAz: 95 },
  hat: { L: .381, s: 1.03, azNeg: .77, azPos: .93, el: .58, roll: 1.17 },
  body: { elBase: 0, elGain: .08, tz: -.42, faceCam: 0 },
  // screen-held directions (degrees on screen, 90 = down): the vest's heavy ink lower right, the pelvis's straight down on standing frames
  ink: { inkDeg: 55, pelvisDeg: 75 },
  // the look the head/hat/torso read when standing (the engineer's front shots f64-92)
  look: { frame: 80 },
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// face: pose [yaw, pitch, roll] on the sphere + mirror. nudge = pose.face.nudge
export function faceRecord(V, ch = {}, R = RULES.face) {
  const az = V.az;
  let yaw = clamp((az < 0 ? R.yawNeg : R.yawPos) * az, -R.clamp, R.clamp);
  let pitch = R.pitchBase + R.pitch * V.el, roll = R.roll;
  if (ch.nudge) { yaw += ch.nudge[0] || 0; pitch += ch.nudge[1] || 0; roll += ch.nudge[2] || 0; }
  const flip = ch.flip === -1 || ch.flip === 1 ? ch.flip : (az > R.flipAz ? -1 : 1);
  const on = ch.on === true || ch.on === false ? ch.on : Math.abs(az) <= R.offAz;
  return { pose: [yaw, pitch, roll], flip, on };
}

// hat: its own view (az el roll) against the camera and its place on screen against the head (u v in d, s), rigid on the rolled head axis
// the fitted gains hold in front (|az| <= 90, all he ever shows); behind they ease to 1 so +180 and -180 meet (no pop of the visor at the back)
export const backGain = (g, az, from = 90) => { const a = Math.abs(az); if (a <= from) return g; const k = Math.min(1, (a - from) / (180 - from)); return g + (1 - g) * k * k * (3 - 2 * k); };
export function hatRecord(V, R = RULES.hat, L = R.L) {
  const r = V.roll * Math.PI / 180;
  return { az: backGain(V.az < 0 ? R.azNeg : R.azPos, V.az) * V.az, el: R.el * V.el, roll: R.roll * V.roll, u: L * Math.sin(r), v: -L * Math.cos(r), s: R.s };
}

// torso: the drawn body = the rig's body frame seen by the camera, with the elevation damped (elGain) and the yaw camera-relative.
// bodyWorld: Matrix4 at the hem (rotation + translation). camera: the camera in the SAME frame as bodyWorld. Returns the torso.js track fields
// { x, y, D, lean, pitch, yaw, sy } (x y D absolute px, angles degrees).
const _bq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _cq = new THREE.Quaternion(), _rel = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3();
export function bodyRecord(bodyWorld, camera, W, H, F, opts = {}, R = RULES.body) {
  bodyWorld.decompose(_bp, _bq, _bs);
  camera.updateMatrixWorld();
  _cq.setFromRotationMatrix(camera.matrixWorld);
  _rel.copy(_cq).invert().multiply(_bq);     // body in the camera's frame
  _e.setFromQuaternion(_rel, 'ZXY');            // = Rz(lean) Rx(pitch) Ry(yaw), as torso.js composes it
  const DEG = 180 / Math.PI;
  const lean = _e.z * DEG, pitchTrue = _e.x * DEG, yaw = _e.y * DEG;
  const pitch = (opts.elBase ?? R.elBase) + (opts.elGain ?? R.elGain) * pitchTrue;
  _v.copy(_bp).applyMatrix4(camera.matrixWorldInverse);
  const z = -_v.z;
  return { x: W / 2 + F * _v.x / z, y: H / 2 - F * _v.y / z, D: F / z, lean, pitch, yaw, sy: opts.sy ?? 1, pitchTrue, depth: z };
}

// ink / shade: screen-held directions as uniforms want them (x right, y up in torso.js's convention)
export function inkDirs(R = RULES.ink) {
  const a = R.inkDeg * Math.PI / 180, b = R.pelvisDeg * Math.PI / 180;
  return { ink: [Math.cos(a), -Math.sin(a)], pelvis: [Math.cos(b), -Math.sin(b)] };
}

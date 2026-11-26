// props/purple.js: the Boss's boiling purple skin (s05c-e). A second layer on the head's ball: same geometry, same vertex shader and the
// same uniforms as head.ball (so it lands on exactly the ball's pixels, nothing of head.js changes), drawn over it where the "liquid" is.
// His frames (truth/boss/MEASURED.md): the purple RISES from the chin f514-520 behind a wavy lighter meniscus, full f520-599, DRAINS from the
// top f600-609 (a rim left at f609). Level is a screen-horizontal line (it stays level when the head rolls). Purple #9d46c8, shade #7e2ca9
// low right like the skin's band, meniscus paler. Hair patch and its ink stay on top as on the white skin.
// Spec: "props": [{ "kind": "purple" }]. Track: head.json `skin: { "<frame>": level }` (0 none .. 1 full; missing frame = 0), via params.tracks.head.
// Params: purple, purpleDark, meniscus (colours), wave (D), waveN (waves across the head), menW (D).
import * as THREE from '../three.js';
import { loadTrack } from '../tracks.js';

const DEF = { purple: '#9d46c8', purpleDark: '#7e2ca9', meniscus: '#c38ae0', wave: .014, waveN: 3.5, menW: .022 };

export async function build(params = {}) {
  const { kind, tracks, limbsTrack, ...own } = params;
  const P = { ...DEF, ...own };
  const head = tracks?.head?.length ? await loadTrack({ tracks: tracks.head }, 'head') : {};
  const root = new THREE.Group(); root.name = 'prop.purple';
  root.userData = { P, levels: head.skin || {}, mesh: null };
  return root;
}

function attach(root) {
  // find the head this prop belongs to: char root -> parts.head
  const charRoot = root.parent, head = charRoot?.userData?.parts?.head?.[1], ball = head?.getObjectByName('head.ball');
  if (!ball) return null;
  const P = root.userData.P, bm = ball.material;
  const U = { ...bm.uniforms, uLevel: { value: 0 }, uCy: { value: 0 }, uCx: { value: 0 }, uDpx: { value: 1 },
    uPurple: { value: new THREE.Color(P.purple) }, uPurpleDark: { value: new THREE.Color(P.purpleDark) }, uMen: { value: new THREE.Color(P.meniscus) },
    uWave: { value: P.wave }, uWaveN: { value: P.waveN }, uMenW: { value: P.menW } };
  const skinLine = /vec3 skin = mix\(uSkinLit, uSkinDark, smoothstep\(uDarkAB\.x, uDarkAB\.y, dot\(nc, uDark\)\)\);/;
  if (!skinLine.test(bm.fragmentShader)) { console.error('purple: head.js skin line not found, purple off'); return null; }
  const frag = bm.fragmentShader
    .replace('void main() {', 'uniform float uLevel, uCy, uCx, uDpx, uWave, uWaveN, uMenW; uniform vec3 uPurple, uPurpleDark, uMen;\nvoid main() {')
    .replace(skinLine, `float shadeK = smoothstep(uDarkAB.x, uDarkAB.y, dot(nc, uDark));
  vec2 q = (gl_FragCoord.xy - vec2(uCx, uCy)) / uDpx;               // head diameters from the head centre, y up
  float lv = uLevel - .5 + uWave * sin(q.x * 6.2831853 * uWaveN + uLevel * 9.);
  float aaP = 1.2 / uDpx;
  if (q.y > lv + aaP) discard;
  vec3 skin = mix(uPurple, uPurpleDark, shadeK);
  skin = mix(skin, uMen, smoothstep(lv - uMenW - aaP, lv - uMenW + aaP, q.y));`);
  const mat = new THREE.ShaderMaterial({ vertexShader: bm.vertexShader, fragmentShader: frag, uniforms: U, depthFunc: THREE.LessEqualDepth });
  const mesh = new THREE.Mesh(ball.geometry, mat); mesh.name = 'head.purple';
  mesh.renderOrder = 1; mesh.frustumCulled = false; mesh.userData.noOutline = true;
  head.add(mesh);
  return mesh;
}

export function update(frame, ctx) {
  const root = ctx.root, ud = root.userData;
  const lvl = +(ud.levels[String(Math.round(frame))] ?? 0);
  if (!ud.mesh && lvl > 0) ud.mesh = attach(root);
  if (!ud.mesh) return;
  ud.mesh.visible = lvl > 0;
  const U = ud.mesh.material.uniforms, c = ctx.cam, H = ctx.height || 1920;
  U.uLevel.value = lvl; U.uCx.value = c.cx; U.uCy.value = H - c.cy; U.uDpx.value = c.d;
}

export default { build, update };

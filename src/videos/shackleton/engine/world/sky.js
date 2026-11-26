// Sky dome, sun, fog, light presets. Fog colour is always the horizon colour.
import * as THREE from "three";
import { LAYER_NOINK } from "../core/post.js";

// Light presets. Numbers are starting values tuned in test renders; a story may override any field.
// sun.az is measured from the camera's view direction at the start of each shot (so the key light
// always rakes across the subject), sun.el is the elevation in degrees.
export const LIGHTS = {
  day: {
    sun: { az: 62, el: 46, color: [1.0, 0.94, 0.84], intensity: 2.9 },
    hemi: { sky: "#9ec2ff", ground: "#9a8462", intensity: 1.3 },
    sky: { top: "#3f86dc", mid: "#7fb1ec", horizon: "#c9def4" },
    fog: { near: 30, far: 320 },
    card: [1.0, 0.98, 0.95],
    grade: { lift: [0.032, 0.028, 0.038], shadowTint: [0.92, 0.97, 1.09], highTint: [1.05, 1.01, 0.95], sat: 1.22, contrast: 1.05, vignette: 0.45 },
    exposure: 1.0,
  },
  golden: {
    sun: { az: 72, el: 14, color: [1.0, 0.7, 0.42], intensity: 3.6 },
    hemi: { sky: "#a99ad6", ground: "#b07a58", intensity: 1.45 },
    sky: { top: "#6a7cd2", mid: "#f2a487", horizon: "#ffd59c" },
    fog: { near: 40, far: 300 },
    card: [1.0, 0.9, 0.8],
    grade: { lift: [0.038, 0.028, 0.042], shadowTint: [0.93, 0.92, 1.07], highTint: [1.09, 1.01, 0.9], sat: 1.12, contrast: 1.05, vignette: 0.45 },
    sunDisc: { color: [3.2, 2.2, 1.3], size: 0.05 },
    exposure: 1.0,
  },
  night: {
    sun: { az: 55, el: 40, color: [0.62, 0.74, 1.0], intensity: 1.35 },
    hemi: { sky: "#5f7ce6", ground: "#3c3c6a", intensity: 1.15 },
    sky: { top: "#13236a", mid: "#2b4aa2", horizon: "#5674c4" },
    fog: { near: 30, far: 240 },
    card: [0.8, 0.85, 1.0],
    grade: { lift: [0.026, 0.028, 0.05], shadowTint: [0.88, 0.94, 1.16], highTint: [1.06, 1.0, 0.92], sat: 1.1, contrast: 1.05, vignette: 0.5 },
    windowsGlow: true,
    exposure: 1.0,
  },
  interior: {
    sun: { az: 50, el: 55, color: [1.0, 0.86, 0.66], intensity: 2.2 },
    hemi: { sky: "#ffe0b8", ground: "#7a5a48", intensity: 2.5 },
    sky: { top: "#3b5aa0", mid: "#6d86c0", horizon: "#a8b8dc" },
    fog: { near: 40, far: 400 },
    card: [1.0, 0.95, 0.88],
    grade: { lift: [0.034, 0.028, 0.03], shadowTint: [0.9, 0.94, 1.1], highTint: [1.07, 1.01, 0.92], sat: 1.15, contrast: 1.05, vignette: 0.35 },
    exposure: 1.0,
  },
};

export function makeSky(scene) {
  const uniforms = {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Vector3() }, sunSize: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false, uniforms,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 top, mid, horizon, sunDir, sunColor; uniform float sunSize; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
          c = mix(c, top, smoothstep(0.22, 0.85, h));
          if (h < 0.0) c = horizon;
          float s = dot(normalize(vDir), normalize(sunDir));
          c += sunColor * (smoothstep(1.0 - sunSize * 0.04, 1.0 - sunSize * 0.03, s) + 0.18 * pow(max(s, 0.0), 64.0));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.userData.ink = "none";
  sky.layers.set(LAYER_NOINK);
  scene.add(sky);
  return sky;
}

// Lighting rig: sun (casts shadows) + hemisphere fill. applyLight() sets it per shot.
export function makeRig(scene, shadowSize = 2048) {
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xffffff, 30, 300);
  return { sun, hemi };
}

const tmp = new THREE.Vector3();
// center: world point the shot looks at; camYaw: camera heading in radians; radius: shadow box half size
export function applyLight({ rig, sky, scene }, L, center, camYaw, radius = 22) {
  let dir;
  if (L.sun.dir) dir = tmp.set(...L.sun.dir).normalize(); // world-fixed sun (interiors with windows, long camera moves)
  else {
    const az = THREE.MathUtils.degToRad(L.sun.az) + camYaw + Math.PI;
    const el = THREE.MathUtils.degToRad(L.sun.el);
    dir = tmp.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  }
  rig.sun.color.setRGB(...L.sun.color);
  rig.sun.intensity = L.sun.intensity;
  rig.sun.position.copy(center).addScaledVector(dir, 80);
  rig.sun.target.position.copy(center);
  rig.sun.target.updateMatrixWorld();
  const cam = rig.sun.shadow.camera;
  cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius; cam.near = 1; cam.far = 200;
  cam.updateProjectionMatrix();
  rig.hemi.color.set(L.hemi.sky); rig.hemi.groundColor.set(L.hemi.ground); rig.hemi.intensity = L.hemi.intensity;
  const u = sky.material.uniforms;
  u.top.value.set(L.sky.top); u.mid.value.set(L.sky.mid); u.horizon.value.set(L.sky.horizon);
  u.sunDir.value.copy(dir);
  if (L.sunDisc) { u.sunColor.value.set(...L.sunDisc.color); u.sunSize.value = L.sunDisc.size * 20; }
  else { u.sunColor.value.set(0, 0, 0); u.sunSize.value = 0; }
  scene.fog.color.set(L.sky.horizon);
  scene.fog.near = L.fog.near; scene.fog.far = L.fog.far;
  return dir.clone();
}

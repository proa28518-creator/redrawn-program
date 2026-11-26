// Practical lights, light shafts, window light patches, glowing screens.
// Light budget: at most MAX_POINT real point lights in a scene (each one costs shading time on every
// lit pixel). Fixtures always glow (HDR material -> bloom); only the chosen ones also cast light.
import * as THREE from "three";
import { glow, mat } from "./shade.js";
import { box, cyl, ball } from "./kit.js";
import { LAYER_NOINK } from "../core/post.js";

export const MAX_POINT = 4;

export function makeLights(W) {
  const L = { points: [], fixtures: [] };
  const budgetLight = (pos, color, intensity, distance) => {
    if (L.points.length >= MAX_POINT) { console.error(`[rc] light budget: more than ${MAX_POINT} point lights; extra light ignored (fixture still glows)`); return null; }
    const pl = new THREE.PointLight(new THREE.Color(color), intensity, distance, 2);
    pl.position.copy(pos); pl.castShadow = false; W.scene.add(pl); L.points.push(pl); return pl;
  };
  // practical({ kind: "ceiling"|"panel"|"pendant"|"desk"|"wall"|"neon", x, y, z, color, intensity, light: true })
  L.practical = (o) => {
    const g = new THREE.Group(); g.name = "light:" + (o.kind || "ceiling");
    const c = new THREE.Color(o.color || "#ffd9a0");
    const hdr = (k) => glow([c.r * k, c.g * k, c.b * k]);
    let emitY = 0;
    switch (o.kind || "ceiling") {
      case "panel": g.add(box(1.2, 0.05, 0.4, mat("flat", { color: "#d8d8d8" }), { y: -0.03 })); g.add(box(1.1, 0.02, 0.32, hdr(2.6), { y: -0.06 })); emitY = -0.2; break;
      case "pendant": g.add(cyl(0.01, 0.01, 0.8, mat("flat", { color: "#222" }), { y: -0.4 })); g.add(cyl(0.08, 0.3, 0.25, mat("flat", { color: o.shade || "#2a3a3a" }), { y: -0.9 })); g.add(ball(0.08, hdr(4.0), { y: -1.0, detail: 1 })); emitY = -1.1; break;
      case "desk": g.add(cyl(0.1, 0.12, 0.03, mat("flat", { color: "#333" }), { y: 0.015 })); g.add(cyl(0.015, 0.015, 0.4, mat("flat", { color: "#333" }), { y: 0.22, rz: 0.3 })); g.add(cyl(0.06, 0.13, 0.14, mat("flat", { color: o.shade || "#3a6a5a" }), { x: -0.1, y: 0.42 })); g.add(ball(0.05, hdr(4.0), { x: -0.1, y: 0.37, detail: 1 })); emitY = 0.3; break;
      case "wall": g.add(box(0.12, 0.25, 0.1, mat("flat", { color: "#333" }), {})); g.add(cyl(0.1, 0.14, 0.18, hdr(3.0), { y: 0.1, z: 0.08 })); emitY = 0.05; break;
      case "neon": { const w = o.w ?? 1.2; g.add(box(w, 0.06, 0.06, hdr(5.0), {})); g.add(box(w * 0.8, 0.06, 0.06, hdr(5.0), { y: -0.18 })); emitY = 0; break; }
      default: g.add(cyl(0.22, 0.28, 0.12, mat("flat", { color: "#e8e4dc" }), { y: -0.06 })); g.add(cyl(0.2, 0.2, 0.02, hdr(3.0), { y: -0.13 })); emitY = -0.4;
    }
    g.position.set(o.x || 0, o.y ?? 3, o.z || 0); if (o.ry) g.rotation.y = o.ry;
    g.traverse((m) => { if (m.isMesh) m.userData.noShadow = true; });
    W.add(g, { collide: false, name: g.name });
    if (o.light) budgetLight(new THREE.Vector3(o.x || 0, (o.y ?? 3) + emitY, o.z || 0), c, o.intensity ?? 6, o.distance ?? 7);
    L.fixtures.push(g);
    return g;
  };
  // a soft beam from a window (or any opening) along direction dir: additive, no depth write, no ink
  L.shaft = (o) => {
    const len = o.length ?? 5, w = o.w ?? 1.0, h = o.h ?? 1.2;
    const geo = new THREE.BoxGeometry(w, h, len).translate(0, 0, len / 2);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { color: { value: new THREE.Color(o.color || "#ffe2b0") }, strength: { value: o.strength ?? 0.22 } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float strength; varying vec3 vP;
        void main(){ float along = clamp(vP.z / ${len.toFixed(2)}, 0.0, 1.0);
          float edge = (1.0 - smoothstep(0.25, 0.5, abs(vP.x) / ${w.toFixed(2)})) * (1.0 - smoothstep(0.25, 0.5, abs(vP.y) / ${h.toFixed(2)}));
          float fall = pow(1.0 - along, 0.8) * smoothstep(0.0, 0.12, along);
          gl_FragColor = vec4(color * strength * edge * fall, 1.0); }`,
    });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(...o.from);
    mesh.lookAt(new THREE.Vector3(...o.from).add(new THREE.Vector3(...o.dir)));
    mesh.userData.ink = "none"; mesh.userData.noShadow = true; mesh.layers.set(LAYER_NOINK); mesh.renderOrder = 5;
    W.scene.add(mesh);
    return mesh;
  };
  // bright patch of window light on the floor: project the window rectangle along dir onto y = 0
  L.patch = (o) => {
    const dir = new THREE.Vector3(...o.dir).normalize();
    if (dir.y >= -0.05) return null;
    const c = new THREE.Vector3(...o.window), w = o.w ?? 1, h = o.h ?? 1.2;
    const k = -c.y / dir.y, centre = c.clone().addScaledVector(dir, k);
    const stretch = Math.min(4, 1 / Math.max(0.2, -dir.y));
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const g = cv.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, "rgba(255,255,255,0)"); grd.addColorStop(0.15, "rgba(255,255,255,1)"); grd.addColorStop(0.85, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(6, 0, 116, 128); g.clearRect(62, 0, 4, 128); g.clearRect(0, 62, 128, 4);
    const tex = new THREE.CanvasTexture(cv);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(o.color || "#ffe2b0").multiplyScalar(o.strength ?? 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h * stretch).rotateX(-Math.PI / 2), m);
    mesh.position.set(centre.x, 0.03, centre.z);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    mesh.userData.ink = "none"; mesh.layers.set(LAYER_NOINK); mesh.renderOrder = 4;
    W.scene.add(mesh);
    return mesh;
  };
  // glowing screen with a painted face: screen({ x,y,z, ry, w, h, paint(g, w, h), brightness })
  L.screen = (o) => {
    const cw = 512, ch = Math.round(512 * (o.h ?? 0.6) / (o.w ?? 1));
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch; const g = cv.getContext("2d");
    if (o.paint) o.paint(g, cw, ch); else { const gr = g.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, "#5ab0e0"); gr.addColorStop(1, "#2a4aa0"); g.fillStyle = gr; g.fillRect(0, 0, cw, ch); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const b = o.brightness ?? 1.6;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(o.w ?? 1, o.h ?? 0.6), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(b, b, b), toneMapped: false }));
    const grp = new THREE.Group(); grp.add(box((o.w ?? 1) + 0.08, (o.h ?? 0.6) + 0.08, 0.05, mat("flat", { color: "#1e1e24" }), { z: -0.03 })); grp.add(face); face.position.z = 0.002;
    grp.position.set(o.x || 0, o.y ?? 1.5, o.z || 0); grp.rotation.y = o.ry || 0;
    W.add(grp, { collide: false, name: "screen" });
    return grp;
  };
  return L;
}

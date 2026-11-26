// RicksClips-Engine entry. The Remotion scene (project/src/Scene.jsx) calls start(story, ctx) once and then
// api.renderAt(t) for every frame. Everything visible is a pure function of the time t.
import * as THREE from "three";
import { buildPost, LAYER_NOINK } from "./core/post.js";
import { rng, FPS, clamp, lerp } from "./core/util.js";
import { makeSky, makeRig, applyLight, LIGHTS } from "./world/sky.js";
import * as kit from "./world/kit.js";
import { mat, glow } from "./world/shade.js";
import { makePalette, tintLight, FAMILIES } from "./world/palette.js";
import { buildSet } from "./world/sets.js";
import { prop, PROP_NAMES } from "./world/props.js";
import { dress, THEMES } from "./world/dress.js";
import { makeLights, MAX_POINT } from "./world/lights.js";
import { paint } from "./world/paint.js";
import { Character, Fx } from "./cast/cast.js";
import { Animal, SPECIES } from "./cast/animals.js";
import { makeLook, PALETTE, EXPRESSIONS, ARM_POSES } from "./cast/toon.js";
import { Director, guardCamera, aim, aerial, planSummary } from "./camera/camera.js";
import { makeCaptions } from "./captions/captions.js";
import { runChecks } from "./core/checks.js";

export { aim, aerial };
export { makePalette, tintLight, buildSet, prop, dress, THEMES, PROP_NAMES, FAMILIES };
export { THREE, kit, mat, glow, paint, rng, LIGHTS, makeLook, PALETTE, EXPRESSIONS, ARM_POSES, FPS, SPECIES };

// style (captions, caption_lowercase, ink_px) comes from project/src/style.json, written from the user's settings
const DEFAULT_STYLE = { captions: true, caption_lowercase: false, ink_px: 8 };

// word helpers for stories: at("bridge") -> start time of the first word matching "bridge" (after `from`)
export function wordClock(words) {
  const n = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
  const exact = (s) => s.replace(/[^A-Za-z0-9']/g, "");
  const at = (text, from = 0) => {
    // exact capitalisation first ("His" = a sentence start), then any case
    // captions may show digits ("50") while "spoken" keeps the script's words ("fifty"): both can be used with at()
    const first = (x) => (x.spoken ? x.spoken.split(" ")[0] : x.text);
    const w = words.find((x) => x.start >= from - 1e-6 && (exact(x.text) === exact(text) || exact(first(x)) === exact(text)))
      || words.find((x) => x.start >= from - 1e-6 && (n(x.text) === n(text) || n(first(x)) === n(text)));
    if (!w) throw new Error(`[rc] word "${text}" not found after ${from}s`);
    return w.start;
  };
  const end = (text, from = 0) => { const s = at(text, from); return words.find((x) => x.start === s).end; };
  return { at, end, i: (k) => words[k].start };
}

// ctx: { root, canvas, W, H, duration, style }. root is the element that holds the canvas (captions are added to it).
export async function start(story, ctx) {
  return setup(story, ctx);
}

async function setup(story, ctx) {
  const { root, canvas } = ctx;
  const W = ctx.W, H = ctx.H, DURATION = ctx.duration;
  // fonts used on canvases (signs, fx) and captions must be loaded before anything is drawn
  try { await document.fonts.load(`800 80px "Montserrat"`); await document.fonts.load(`900 80px "Montserrat"`); await document.fonts.load(`900 80px "Nunito"`); } catch { /* fallback font */ }
  const style = { ...DEFAULT_STYLE, ...(ctx.style || {}) };
  const inkPx = Number(story.inkPx ?? style.ink_px ?? 8); // outline of characters, props and animals, px at 1080 wide

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true, stencil: false });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 1200);
  camera.layers.enable(LAYER_NOINK);
  const sky = makeSky(scene);
  const rig = makeRig(scene, story.shadowMap || 4096);
  const rand = rng(story.seed ?? 1);
  const world = kit.makeWorld(scene, rand);
  const cast = {};
  const fx = new Fx(scene);
  const castApi = {
    add(def) { const c = new Character({ seed: Object.keys(cast).length + 1, inkPx, H, ...def }, scene); cast[def.name] = c; return c; },
    animal(def) { const c = new Animal({ seed: Object.keys(cast).length + 1, inkPx, H, ...def }, scene); cast[def.name] = c; return c; },
  };
  const words = story.words || [];
  const clock = wordClock(words);
  const lightKit = makeLights(world);
  const plan = story.build({ W: world, aim, aerial, kit, mat, glow, paint, rand, cast: castApi, fx, makeLook, clock, THREE, scene, LIGHTS,
    makePalette, tintLight, buildSet, prop, dress, lights: lightKit }) || {};
  await Promise.all(world.pending);
  const director = new Director(plan.camera || [], { kicks: plan.kicks || [] });
  // shot plan against the rules (scene-direction.md): printed, never fatal
  const planInfo = planSummary(director, DURATION);
  const planRule = (ok, msg) => { if (!ok) console.error(`[rc] plan check: ${msg}`); };
  const per10 = (n) => n / Math.max(1, DURATION) * 10;
  planRule(per10(planInfo.scene_changes) >= 1.1 && per10(planInfo.scene_changes) <= 2.8, `${planInfo.scene_changes} scene changes (cuts and camera glides) = ${per10(planInfo.scene_changes).toFixed(1)} per 10 s (rule 1.1-2.8)`);
  planRule(per10(planInfo.cuts) <= 2.8, `${planInfo.cuts} hard cuts = ${per10(planInfo.cuts).toFixed(1)} per 10 s (rule at most 2.8; reach nearby places with a camera glide)`);
  planRule(planInfo.median_shot_s >= 1.6 && planInfo.median_shot_s <= 7.6, `median shot ${planInfo.median_shot_s} s (rule 1.6-7.6 s)`);
  planRule(DURATION < 40 || planInfo.quick_shots_under_1s >= 3, `${planInfo.quick_shots_under_1s} quick shots under 1 s (rule: at least one cluster of 3-4 in a long short)`);
  planRule(DURATION < 30 || planInfo.holds_over_5s >= 1, `${planInfo.holds_over_5s} holds of 5 s or more (rule: long holds between clusters)`);
  planRule(planInfo.push_or_pull_share >= 0.7, `${Math.round(planInfo.push_or_pull_share * 100)} % of shots push or pull (rule: almost every shot keeps moving)`);
  planRule(planInfo.whips_and_flashes <= 4, `${planInfo.whips_and_flashes} whips/flash wipes (rule at most 4)`);
  planRule(DURATION < 40 || planInfo.aerials >= 1, `${planInfo.aerials} aerial or top-down shots (rule: at least 1 in a long short, at most 5)`);
  planRule(planInfo.aerials <= 5, `${planInfo.aerials} aerial or top-down shots (rule at most 5)`);
  const lights = { ...LIGHTS, ...(story.lights || {}) };
  const post = buildPost({ renderer, scene, camera, W, H, inkPx });
  const overlay = document.createElement("canvas"); overlay.width = W; overlay.height = H;
  Object.assign(overlay.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "5", display: "none" });
  canvas.after(overlay);
  const og = overlay.getContext("2d");
  const caps = makeCaptions(root, words, H, { enabled: story.captions ?? style.captions, lowercase: story.captionLowercase ?? style.caption_lowercase, style: story.captionStyle });

  const headsOnScreen = (t) => {
    director.apply(camera, t);
    const out = [];
    for (const c of Object.values(cast)) {
      if (!c.lastBefore(c.vis, t, true)) continue;
      const p = c.eyes(t).project(camera);
      if (p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1) out.push([(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H]);
    }
    return out;
  };
  caps.planDodge(headsOnScreen);
  const warnings = guardCamera(director, world.colliders, DURATION, camera);
  // framing check: a character the lens focuses on must be inside the frame
  for (let f = 0; f <= Math.round(DURATION * FPS); f += 3) {
    const t = f / FPS, st = director.apply(camera, t), fo = st.key.lens?.focus;
    if (typeof fo !== "string" || !cast[fo] || st.gliding) continue;
    const p = cast[fo].eyes(t).project(camera);
    if (Math.abs(p.x) > 0.92 || Math.abs(p.y) > 0.92 || p.z > 1) {
      const msg = `focus subject "${fo}" is outside the frame`;
      if (!warnings.some((w) => w.msg === msg && Math.abs(w.frame - f) < 30)) { warnings.push({ frame: f, msg }); console.error(`[rc] camera check, frame ${f}: ${msg}`); }
    }
  }

  // shot checks at every key arrival (and the middle of long holds): head size and scene fullness
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), bb = new THREE.Box3(), corners = [...Array(8)].map(() => new THREE.Vector3());
  const screenArea = (box) => {
    const c = [box.min, box.max]; let i = 0, x0 = 1, x1 = -1, y0 = 1, y1 = -1;
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) { const v = corners[i++].set(c[x].x, c[y].y, c[z].z).project(camera); if (v.z > 1) continue; x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    return Math.max(0, Math.min(1, x1) - Math.max(-1, x0)) * Math.max(0, Math.min(1, y1) - Math.max(-1, y0)) / 4;
  };
  const shotReport = [];
  director.keys.forEach((k, idx) => {
    const end = director.keys[idx + 1]?.t ?? DURATION;
    for (const t of [k.t + 0.05, (k.t + end) / 2]) {
      if (t > DURATION) continue;
      const st = director.apply(camera, t);
      if (st.gliding) continue;
      pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
      let objects = 0; const bands = new Set();
      for (const c of world.colliders) {
        if (c.kind === "wall" || !c.obj.visible) continue;
        if (!frustum.intersectsBox(c.box)) continue;
        if (screenArea(c.box) < 0.002) continue;
        objects++;
        const d = c.box.distanceToPoint(camera.position);
        bands.add(d < 3.5 ? "fg" : d < 7 ? "mid" : "bg");
      }
      for (const ch of Object.values(cast)) {
        if (!ch.lastBefore(ch.vis, t, true)) continue;
        const p = ch.eyes(t).project(camera);
        if (p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1) { objects++; const d = camera.position.distanceTo(ch.eyes(t)); bands.add(d < 3.5 ? "fg" : d < 7 ? "mid" : "bg"); }
      }
      const fo = k.lens?.focus;
      let head = null;
      if (typeof fo === "string" && cast[fo] && cast[fo].look?.heads) {
        const ch = cast[fo], dist = camera.position.distanceTo(ch.eyes(t));
        const headW = ch.h / ch.look.heads;
        const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
        head = headW / (2 * dist * Math.tan(hfov / 2)); // share of the frame width (reported, not a rule)
      }
      const closeUp = head != null && head > 0.2;
      const aerial = st.key.aerial || (st.key.pos[1] - st.key.look[1]) > 6;
      if (!closeUp && !aerial && objects < 6) console.error(`[rc] shot check t=${t.toFixed(2)}: only ${objects} objects in view (rule: at least 6 in mediums and wides)`);
      if (!closeUp && !aerial && bands.size < 3) console.error(`[rc] shot check t=${t.toFixed(2)}: ${bands.size} depth layers (rule: foreground, middle and background)`);
      shotReport.push({ t: +t.toFixed(2), objects, layers: bands.size, head: head == null ? null : +head.toFixed(3) });
    }
  });
  warnings.push(...runChecks({ THREE, cast, world, scene, camera, director, DURATION, FPS }));
  if (lightKit.points.length > MAX_POINT) console.error(`[rc] light budget exceeded`);

  const yawOf = (k) => k.sunYaw ?? Math.atan2(k.look[0] - k.pos[0], k.look[2] - k.pos[2]);
  const focusPoint = (lens, t) => {
    if (!lens || !lens.focus) return null;
    if (typeof lens.focus === "string") { const c = cast[lens.focus]; if (!c) throw new Error(`[rc] lens focus "${lens.focus}" is not a cast member`); return c.eyes(t); }
    return new THREE.Vector3(...lens.focus);
  };

  let lastNight = null;
  const hfovFocal = () => (W / 2) / Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect));
  const ceilings = []; scene.traverse((o) => { if (o.userData.ceiling) ceilings.push(o); });
  function draw(t, k, prevKey, gliding, glideU) {
    const L = lights[k.light || story.light || "day"];
    for (const c of ceilings) c.visible = !k.aerial; // aerial shots look into rooms from above
    const center = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8).add(camera.position);
    applyLight({ rig, sky, scene }, L, center, yawOf(k), k.shadowRadius || 24);
    post.grade.set(L.grade);
    const night = !!L.windowsGlow;
    if (night !== lastNight) {
      scene.traverse((o) => { const n = o.userData.nightSwap; if (n) o.material = (n.always || (night && n.lit)) ? n.night : n.day; });
      lastNight = night;
    }
    for (const c of Object.values(cast)) c.update(t, camera, L);
    fx.update(t, camera);
    const pxNow = k.lens?.px ?? 0, pxPrev = prevKey?.lens?.px ?? 0;
    const px = gliding ? lerp(pxPrev, pxNow, glideU) : pxNow;
    const fp = focusPoint(k.lens?.focus ? k.lens : prevKey?.lens, t);
    post.setLens(px > 0.05 ? fp : null, px, scene.fog.far);
    if (plan.onFrame) plan.onFrame(t, { scene, camera, cast, world });
    post.render();
  }
  function renderAt(t) {
    t = clamp(t, 0, DURATION);
    const s = director.state(t);
    // whip: smear length from the yaw speed (pixels per frame at 1920 high)
    const s0 = director.state(Math.max(0, t - 1 / FPS));
    director.place(camera, s.pos, s.look, s.fov, s.roll, s.kx, s.ky, s.whip);
    const smearPx = Math.abs(s.whip - s0.whip) * hfovFocal() * (1920 / H) * 0.8;
    post.setSmear(s.whip ? Math.min(220, smearPx) : 0);
    if (s.mix) {
      // dissolve: render the old place, keep it on the overlay, then render the new place under it
      director.place(camera, s.mix.from.pos, s.mix.from.look, s.mix.fromKey.fov, s.mix.fromKey.roll);
      draw(t, s.mix.fromKey, director.keys[Math.max(0, s.keyIndex - 2)], false, 1);
      og.clearRect(0, 0, W, H); og.drawImage(canvas, 0, 0, W, H);
      overlay.style.display = "block"; overlay.style.opacity = String(1 - s.mix.u);
      director.place(camera, s.pos, s.look, s.fov, s.roll, s.kx, s.ky, s.whip);
    } else overlay.style.display = "none";
    draw(t, s.key, s.prev, s.gliding, s.glideU);
    if (s.flash) {
      // white wipe: grows from the left edge over the old shot, shrinks to the right edge over the new one
      const e = s.flash.u * s.flash.u * (3 - 2 * s.flash.u);
      og.clearRect(0, 0, W, H); og.fillStyle = "#fffaf0";
      const slant = W * 0.35;
      og.beginPath();
      if (s.flash.phase === "in") { const x = -slant + e * (W + 2 * slant); og.moveTo(0, 0); og.lineTo(x + slant, 0); og.lineTo(x, H); og.lineTo(0, H); }
      else { const x = -slant + e * (W + 2 * slant); og.moveTo(x + slant, 0); og.lineTo(W + slant, 0); og.lineTo(W, H); og.lineTo(x, H); }
      og.closePath(); og.fill();
      overlay.style.display = "block"; overlay.style.opacity = "1";
    }
    caps.update(t);
  }
  const api = { renderAt, scene, camera, cast, world, director, warnings, renderer, post, shotReport, plan: planInfo, lights: lightKit };
  window.__rc = api;
  return api;
}

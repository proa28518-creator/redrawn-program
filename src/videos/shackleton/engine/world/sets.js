// Interior set builder: connected rooms with real walls, doorways, windows, ceilings, trims.
// Shared walls between two rooms are built ONCE (no coplanar faces), with openings from both rooms.
//
// buildSet(W, { palette, rooms: [ { id, x, z, w, d, h, floor:{kind,color}, wall:{kind,color}, ceiling:true|false|{color},
//                 open: ["s"],                         // sides with no wall (e.g. the street side of a shop)
//                 openings: [ { side:"n"|"s"|"e"|"w", at: 0, w: 1.1, h: 2.2, kind:"door"|"arch"|"window", sill: 0.9 } ] } ] })
// Side naming: n = -z wall, s = +z wall, w = -x wall, e = +x wall. `at` is the offset from the wall centre (metres).
// Returns { rooms: {id: {x,z,w,d,h, wallsInside: [...]} }, windows: [ {pos, normal, w, h} ] } for dressing and lighting.
import * as THREE from "three";
import { mat, glow } from "./shade.js";
import { box, worldUV } from "./kit.js";
import { shadeHex } from "../core/util.js";

const T = 0.2; // wall thickness

export function buildSet(W, spec) {
  const pal = spec.palette;
  const rooms = spec.rooms.map((r) => ({ h: 3.2, open: [], openings: [], ceiling: true, ...r }));
  const lines = new Map(); // key -> { axis, coord, segs: [[a,b,room,sideSign]], openings: [] }
  const out = { rooms: {}, windows: [], doors: [] };
  const addLine = (axis, coord, a, b, room, sign, openings) => {
    const key = axis + ":" + coord.toFixed(2);
    if (!lines.has(key)) lines.set(key, { axis, coord, segs: [], openings: [], h: 0 });
    const L = lines.get(key);
    L.segs.push([a, b, room, sign]); L.openings.push(...openings); L.h = Math.max(L.h, room.h);
  };
  for (const r of rooms) {
    const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
    const ops = (side, base) => r.openings.filter((o) => o.side === side).map((o) => ({ ...o, c: base + (o.at || 0), room: r.id }));
    if (!r.open.includes("n")) addLine("x", z0, x0, x1, r, +1, ops("n", r.x));
    if (!r.open.includes("s")) addLine("x", z1, x0, x1, r, -1, ops("s", r.x));
    if (!r.open.includes("w")) addLine("z", x0, z0, z1, r, +1, ops("w", r.z));
    if (!r.open.includes("e")) addLine("z", x1, z0, z1, r, -1, ops("e", r.z));
    // floor (no crease lines with the walls) and ceiling
    const fm = mat(r.floor?.kind || "planks", { color: r.floor?.color || pal?.floor || "#9a6a42", seed: 90 + rooms.indexOf(r), count: 8, check: r.floor?.check });
    const fl = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(r.w, r.d).rotateX(-Math.PI / 2), r.floor?.uv || 1.6), fm);
    fl.position.set(r.x, 0.012 + rooms.indexOf(r) * 0.0005, r.z); fl.userData.ink = "ground"; fl.userData.noShadow = true;
    W.add(fl, { collide: false, name: "floor:" + r.id });
    if (r.ceiling) {
      const cm = mat("plaster", { color: r.ceiling.color || pal?.ceiling || "#e8e2d6", seed: 95 });
      const ce = box(r.w + T, 0.12, r.d + T, cm, { x: r.x, y: r.h + 0.06, z: r.z });
      ce.userData.ceiling = true; // hidden in aerial shots so a top-down view looks into the room
      W.add(ce, { name: "ceiling:" + r.id, kind: "wall" });
    }
    out.rooms[r.id] = { ...r, x0, x1, z0, z1 };
    (W.rooms ||= []).push({ id: r.id, x0, x1, z0, z1, h: r.h });
  }
  // build every wall line once
  for (const L of lines.values()) {
    const a = Math.min(...L.segs.map((s) => s[0])), b = Math.max(...L.segs.map((s) => s[1]));
    const roomPlus = L.segs.find((s) => s[3] === +1)?.[2], roomMinus = L.segs.find((s) => s[3] === -1)?.[2];
    const mPlus = roomPlus ? mat(roomPlus.wall?.kind || "plaster", { color: roomPlus.wall?.color || pal?.wall || "#e6cfa8", seed: 100 }) : null;
    const mMinus = roomMinus ? mat(roomMinus.wall?.kind || "plaster", { color: roomMinus.wall?.color || pal?.wall || "#e6cfa8", seed: 101 }) : null;
    const edgeM = mat("flat", { color: pal?.trim || "#5b3b2a" });
    // faces: +x,-x,+y,-y,+z,-z ; for an x-line (normal z) the +z face looks into the room on +z
    const faceMats = L.axis === "x" ? [edgeM, edgeM, edgeM, edgeM, mPlus || mMinus, mMinus || mPlus] : [mPlus || mMinus, mMinus || mPlus, edgeM, edgeM, edgeM, edgeM];
    const ops = L.openings.slice().sort((p, q) => p.c - q.c);
    let cur = a;
    const piece = (from, to, y0, y1) => {
      if (to - from < 0.02 || y1 - y0 < 0.02) return;
      const len = to - from, mid = (from + to) / 2, hh = y1 - y0;
      const m = new THREE.Mesh(worldUV(L.axis === "x" ? new THREE.BoxGeometry(len, hh, T) : new THREE.BoxGeometry(T, hh, len), 1), faceMats);
      if (L.axis === "x") m.position.set(mid, y0 + hh / 2, L.coord); else m.position.set(L.coord, y0 + hh / 2, mid);
      W.add(m, { name: "wall", kind: "wall" });
    };
    for (const o of ops) {
      const oa = o.c - o.w / 2, ob = o.c + o.w / 2;
      piece(cur, oa, 0, L.h);
      const top = o.kind === "window" ? (o.sill || 0.9) + (o.h || 1.2) : (o.h || 2.2);
      piece(oa, ob, top, L.h);                                         // lintel
      if (o.kind === "window") piece(oa, ob, 0, o.sill || 0.9);        // wall under the window
      frameOpening(W, L, o, pal);
      const nrm = L.axis === "x" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const pos = L.axis === "x" ? new THREE.Vector3(o.c, (o.kind === "window" ? (o.sill || 0.9) + (o.h || 1.2) / 2 : (o.h || 2.2) / 2), L.coord) : new THREE.Vector3(L.coord, (o.kind === "window" ? (o.sill || 0.9) + (o.h || 1.2) / 2 : (o.h || 2.2) / 2), o.c);
      (o.kind === "window" ? out.windows : out.doors).push({ pos, normal: nrm, w: o.w, h: o.h || (o.kind === "window" ? 1.2 : 2.2), axis: L.axis, sill: o.sill || 0.9, room: o.room });
      cur = ob;
    }
    piece(cur, b, 0, L.h);
    // skirting board on both faces
    for (const sgn of [-1, 1]) {
      const sk = mat("flat", { color: shadeHex(pal?.trim || "#5b3b2a", 0.1) });
      let c2 = a;
      for (const o of [...ops, { c: b + 999, w: 0 }]) {
        const oa = Math.min(b, o.c - o.w / 2);
        if (o.kind !== "window" && oa - c2 > 0.05) {
          const len = oa - c2, mid = (c2 + oa) / 2;
          const g = L.axis === "x" ? box(len, 0.14, 0.03, sk, { x: mid, y: 0.07, z: L.coord + sgn * (T / 2 + 0.016) }) : box(0.03, 0.14, len, sk, { x: L.coord + sgn * (T / 2 + 0.016), y: 0.07, z: mid });
          W.add(g, { collide: false, name: "skirting" });
        }
        if (o.kind !== "window") c2 = o.c + o.w / 2;
      }
    }
  }
  return out;
}

function frameOpening(W, L, o, pal) {
  const trim = mat("wood", { color: pal?.trim || "#5b3b2a", seed: 110 });
  const g = new THREE.Group();
  const h = o.kind === "window" ? (o.h || 1.2) : (o.h || 2.2), y0 = o.kind === "window" ? (o.sill || 0.9) : 0;
  const t = T + 0.06;
  g.add(box(0.1, h + 0.1, t, trim, { x: -o.w / 2 - 0.05, y: y0 + h / 2 }));
  g.add(box(0.1, h + 0.1, t, trim, { x: o.w / 2 + 0.05, y: y0 + h / 2 }));
  g.add(box(o.w + 0.2, 0.1, t, trim, { y: y0 + h + 0.05 }));
  if (o.kind === "window") {
    g.add(box(o.w + 0.3, 0.08, t + 0.12, trim, { y: y0 - 0.04 }));
    g.add(box(0.06, h, 0.05, trim, { y: y0 + h / 2 }));
    g.add(box(o.w, 0.06, 0.05, trim, { y: y0 + h / 2 }));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(o.w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.3, 1.4), transparent: true, opacity: 0.18, depthWrite: false }));
    glass.position.y = y0 + h / 2; glass.userData.ink = "none"; g.add(glass);
  }
  if (o.kind === "door" && o.leaf !== false) {
    const leaf = box(o.w - 0.06, h - 0.04, 0.05, mat("planks", { color: o.color || pal?.accent || "#6b3d2a", seed: 111, count: 4 }), { x: -o.w / 2 + 0.03 + (o.w - 0.06) / 2, y: h / 2 });
    const hinge = new THREE.Group(); hinge.position.x = -o.w / 2; leaf.position.x = (o.w - 0.06) / 2 + 0.03; hinge.add(leaf);
    hinge.rotation.y = (o.openAngle ?? 1.25) * (o.swing || 1);
    g.add(hinge);
  }
  if (L.axis === "x") g.position.set(o.c, 0, L.coord); else { g.position.set(L.coord, 0, o.c); g.rotation.y = Math.PI / 2; }
  W.add(g, { collide: false, name: o.kind + "-frame" });
}

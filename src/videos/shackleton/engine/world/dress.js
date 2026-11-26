// Set dressing: fill a room from a theme so every medium/wide frame has enough to look at.
// dress(W, room, theme, { pal, keepClear: [[x, z, radius], ...], density: 1, centre: true })
// room = one entry of buildSet(...).rooms. Doors/windows from buildSet are kept clear automatically.
// Places: floor props along the solid walls, wall decor between them, clutter on tops, a centre piece.
import { prop } from "./props.js";

export const THEMES = {
  office: { floor: ["filingCabinet", "bookshelf", "plant", "waterCooler", "cabinet", "printerDesk", "locker"], wall: ["noticeBoard", "poster", "clock", "frame", "whiteboard", "calendar"], clutter: ["mug", "bookPile", "phone", "monitor", "boxSmall"], centre: "deskSet" },
  home: { floor: ["bookshelf", "armchair", "plant", "cabinet", "floorLampShade", "sofa"], wall: ["frame", "frame", "clock", "wallShelf", "poster", "curtainWin"], clutter: ["mug", "bookPile", "bottle", "plant"], centre: "rugTable" },
  kitchen: { floor: ["counter", "fridge", "stove", "sink", "shelf", "cabinet"], wall: ["wallShelf", "clock", "calendar", "frame"], clutter: ["mug", "bottle", "boxSmall"], centre: "kitchenTable" },
  shop: { floor: ["shopShelf", "shopShelf", "vendingMachine", "crateStack", "fridge", "counter"], wall: ["poster", "poster", "clock", "noticeBoard"], clutter: ["boxSmall", "bottle", "boxSmall"], centre: "counterIsland" },
  lab: { floor: ["labBench", "cabinet", "shelf", "filingCabinet", "computerDesk"], wall: ["whiteboard", "poster", "clock", "vent"], clutter: ["bottle", "boxSmall", "monitor"], centre: "labIsland" },
  classroom: { floor: ["bookshelf", "cabinet", "plant", "locker"], wall: ["boardDark", "poster", "clock", "noticeBoard"], clutter: ["bookPile", "mug"], centre: "deskRows" },
  workshop: { floor: ["workbench", "crateStack", "shelf", "sacks", "ladder", "cabinet"], wall: ["toolBoard", "pipe", "poster", "vent"], clutter: ["boxSmall", "bottle", "bookPile"], centre: "crateIsland" },
  hall: { floor: ["bench", "plant", "locker", "vendingMachine", "bin", "extinguisherProp"], wall: ["poster", "noticeBoard", "clock", "vent", "frame"], clutter: [], centre: null },
};

// composite helpers used by themes
const COMPOSITE = {
  printerDesk(W, o) { const d = prop.desk(W, { ...o, w: 1.2 }); prop.printer(W, { ...o, x: o.x, y: 0.79, z: o.z }); return d; },
  computerDesk(W, o) { const d = prop.desk(W, { ...o, w: 1.3 }); prop.monitor(W, { ...o, y: 0.79 }); return d; },
  curtainWin(W, o) { return prop.curtain(W, o); },
  boardDark(W, o) { return prop.whiteboard(W, { ...o, w: 2.4, dark: true }); },
  extinguisherProp(W, o) { return prop.extinguisher(W, { ...o, y: 0 }); },
};
const make = (name) => prop[name] || COMPOSITE[name];

const CENTRES = {
  deskSet(W, R, o, r) { const d = prop.desk(W, { pal: o.pal, x: R.x, z: R.z, ry: 0 }); prop.officeChair(W, { pal: o.pal, x: R.x - 0.2, z: R.z + 0.7, ry: Math.PI + 0.3 }); prop.monitor(W, { pal: o.pal, x: R.x - 0.2, y: 0.79, z: R.z - 0.15 }); prop.mug(W, { pal: o.pal, x: R.x + 0.4, y: 0.79, z: R.z + 0.1 }); return 4; },
  rugTable(W, R, o) { prop.rug(W, { pal: o.pal, x: R.x, z: R.z, w: Math.min(3, R.w * 0.5), d: Math.min(2, R.d * 0.45) }); prop.table(W, { pal: o.pal, x: R.x, z: R.z, w: 1.0, d: 0.6, h: 0.45 }); prop.bookPile(W, { pal: o.pal, x: R.x + 0.2, y: 0.48, z: R.z }); return 3; },
  kitchenTable(W, R, o) { prop.table(W, { pal: o.pal, x: R.x, z: R.z, cloth: o.pal?.propLight }); for (const s of [-1, 1]) prop.chair(W, { pal: o.pal, x: R.x + s * 0.8, z: R.z, ry: s > 0 ? -Math.PI / 2 : Math.PI / 2 }); prop.bottle(W, { pal: o.pal, x: R.x, y: 0.79, z: R.z }); return 4; },
  counterIsland(W, R, o) { prop.counter(W, { pal: o.pal, x: R.x, z: R.z + R.d * 0.15, w: Math.min(2.4, R.w * 0.4) }); prop.boxSmall(W, { pal: o.pal, x: R.x - 0.4, y: 0.93, z: R.z + R.d * 0.15 }); return 2; },
  labIsland(W, R, o) { prop.labBench(W, { pal: o.pal, x: R.x, z: R.z }); return 1; },
  deskRows(W, R, o) { let n = 0; for (let i = -1; i <= 1; i++) for (let k = 0; k < 2; k++) { prop.desk(W, { pal: o.pal, x: R.x + i * 1.6, z: R.z - 0.4 + k * 1.5, w: 1.0, d: 0.55 }); prop.chair(W, { pal: o.pal, x: R.x + i * 1.6, z: R.z + 0.2 + k * 1.5, ry: Math.PI }); n += 2; } return n; },
  crateIsland(W, R, o) { prop.crateStack(W, { pal: o.pal, x: R.x, z: R.z, n: 2 }); prop.crateStack(W, { pal: o.pal, x: R.x + 0.8, z: R.z + 0.3, n: 1 }); return 2; },
};

function clearOf(x, z, keep, rad) { return keep.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + rad); }

export function dress(W, R, theme, o = {}) {
  const T = THEMES[theme] || THEMES.home;
  const r = W.rand.fork(Math.round(R.x * 7 + R.z * 13 + theme.length));
  const keep = [...(o.keepClear || [])];
  for (const d of o.set?.doors || []) if (d.room === R.id || true) keep.push([d.pos.x, d.pos.z, 1.1]);
  for (const w of o.set?.windows || []) keep.push([w.pos.x, w.pos.z, w.w / 2 + 0.2]);
  let count = 0, wi = 0;
  const density = o.density ?? 1;
  const sides = [
    { side: "n", ry: 0, along: (u) => [R.x0 + u, R.z0 + 0.35], len: R.w, inward: [0, 1] },
    { side: "e", ry: -Math.PI / 2, along: (u) => [R.x1 - 0.35, R.z0 + u], len: R.d, inward: [-1, 0] },
    { side: "w", ry: Math.PI / 2, along: (u) => [R.x0 + 0.35, R.z1 - u], len: R.d, inward: [1, 0] },
    { side: "s", ry: Math.PI, along: (u) => [R.x1 - u, R.z1 - 0.35], len: R.w, inward: [0, -1] },
  ].filter((s) => !(R.open || []).includes(s.side) && !(o.skipSides || []).includes(s.side));
  for (const S of sides) {
    const step = 1.5 / density;
    for (let u = 0.8; u < S.len - 0.6; u += step * (0.8 + r() * 0.5)) {
      const [x, z] = S.along(u);
      if (!clearOf(x, z, keep, 0.5)) continue;
      const name = r.pick(T.floor), f = make(name);
      if (!f) continue;
      const g = f(W, { pal: o.pal, x, z, ry: S.ry });
      count++;
      if (g?.userData?.top && T.clutter.length && r() < 0.8) {
        const c = make(r.pick(T.clutter));
        c?.(W, { pal: o.pal, x: x + (r() - 0.5) * 0.4 * Math.abs(S.inward[1]), y: g.userData.top, z: z + (r() - 0.5) * 0.4 * Math.abs(S.inward[0]), ry: S.ry });
        count++;
      }
      // wall decor above / between
      if (T.wall.length && r() < 0.75 * density) {
        const wname = T.wall[(wi++) % T.wall.length], wf = make(wname);
        const off = 0.11; // just in front of the wall face
        const wx = x - S.inward[0] * (0.35 - off), wz = z - S.inward[1] * (0.35 - off);
        const tall = ["bookshelf", "locker", "fridge", "vendingMachine", "shelf", "shopShelf", "filingCabinet", "waterCooler"].includes(name);
        if (!tall) { wf?.(W, { pal: o.pal, x: wx, z: wz, ry: S.ry, y: ["clock", "vent", "pipe"].includes(wname) ? undefined : 1.55 + r() * 0.3 }); count++; }
      }
    }
  }
  if (o.centre !== false && T.centre && CENTRES[T.centre] && clearOf(R.x, R.z, keep, 1.0)) count += CENTRES[T.centre](W, R, o, r);
  // ceiling fixtures (glowing panels; real light sources are added separately within the light budget)
  if (o.ceilingLights !== false && R.ceiling) {
    const nx = Math.max(1, Math.round(R.w / 3.2)), nz = Math.max(1, Math.round(R.d / 3.2));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { o.fixture?.(W, { x: R.x0 + (i + 0.5) * (R.w / nx), z: R.z0 + (k + 0.5) * (R.d / nz), y: R.h }); count++; }
  }
  return count;
}

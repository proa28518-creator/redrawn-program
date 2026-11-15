// Timeline of "Indiana Bell" (1930): the 8-storey, 11,000-ton Indiana Bell telephone
// building in Indianapolis was rotated 90 degrees on steel rollers over one month —
// 15 inches per hour — while 600 staff kept working inside and not one call dropped.
// 26 shots timed to the locked voice audio (voice.wav, 152 words, 59.20 s, 1776 frames @ 30 fps)
// and the owner's word-level timing file. Shot boundaries follow production_brief.txt exactly.
// Governing rules (owner's direct word):
//   1. NO captions / subtitles / text overlays anywhere. In-scene 3D props only where the
//      brief itself specifies them (blueprint, 1930 sign, 90° arrow, ruler, 3D counters).
//   2. Cross-section / X-ray visuals ONLY in beat 4 (shots 20–22). Never earlier or later.
//   3. Every shot has a NAMED camera move — zero static frames anywhere.
//   4. Shot 1 frame 0 is action already in progress (no title card); Shot 26 is a closed
//      golden ending (no loop).

export const FPS = 30;
export const TOTAL = 1776;
export const D0 = 0;
export type V3 = [number, number, number];

// World X-zone centers (kept well separated so sets never photobomb each other):
export const X_SITE = 0;      // Shots 1-3, 14-17, 24-26: the building on rollers, street & lot
export const X_PLAN = -90;    // Shots 4, 9: giant blueprint table, 1930 sign, rotating model
export const X_OFFICE = -180; // Shots 5, 10, 18, 19: telephone exchange office hall interior
export const X_SWITCH = -270; // Shot 6: switchboard room, operators & blinking panels
export const X_MEET = 90;     // Shots 7, 8, 11: engineers' meeting room, blueprint board, red X
export const X_IMAGINE = 180; // Shots 12, 13: imagination — giant scale & pipes, cracking wall
export const X_XRAY = 270;    // Shots 20-22 ONLY: underground cross-section (rollers, flex pipes)
export const X_DOOR = 360;    // Shot 23: entrance frontage & moving steel bridge

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

export type Light = "day" | "golden" | "dusk";
export type ShotDef = {
  id: number;
  a: number;
  b: number;
  mid: number;
  light: Light;
  move: string;
  xray: boolean;
  sfx: string;
  tau: (t: number) => number;
};

const mkShot = (id: number, a: number, b: number, light: Light, move: string, sfx: string): ShotDef => ({
  id,
  a,
  b,
  mid: Math.floor((a + b) / 2),
  light,
  move,
  xray: id >= 20 && id <= 22,
  sfx,
  tau: (t: number) => t,
});

// Frame ranges = brief seconds x 30 fps (0.0s = f0, 59.2s = f1776)
export const SHOTS: ShotDef[] = [
  mkShot(1, 0, 60, "day", "Low-Angle Fast Push-in (Building Base & Jacks)", "Heavy metal creak + ratchet clicks"),
  mkShot(2, 60, 120, "day", "ECU Lateral Pan (Steel Rollers Under Beams)", "Heavy steel rolling friction"),
  mkShot(3, 120, 180, "day", "Wide Slow Tracking (Building Slides)", "Deep low rumble of moving mass"),
  mkShot(4, 180, 270, "day", "Top-Down Dolly-in (Blueprint & 1930 Sign)", "Blueprint snap + faint old city ambience"),
  mkShot(5, 270, 345, "day", "Pass-Through Window Push-in (600 Staff Hall)", "Busy office murmur + typewriters"),
  mkShot(6, 345, 420, "day", "Medium Fast Orbit (Switchboard Row)", "Overlapping old phone rings + plug clicks"),
  mkShot(7, 420, 480, "day", "Two-Shot Zoom-in (Demolition Engineers)", "Warning tone + wrecking ball chain rattle"),
  mkShot(8, 480, 555, "day", "Close-Up Push-in (Hero Engineer Wipes the X)", "Eraser scribble + confident pop"),
  mkShot(9, 555, 630, "day", "Top-Down + Camera Rolls 90° (Rotating Model)", "Smooth mechanical turn whoosh"),
  mkShot(10, 630, 690, "day", "Medium Fast Push-in (Operator & Desk Clock)", "Clear clock ticking + phone ring"),
  mkShot(11, 690, 735, "day", "Wide Zoom-in (Engineers Laughing)", "Short mocking group laugh"),
  mkShot(12, 735, 810, "day", "Medium Push-in + Shake (Scale & Bursting Pipes)", "Pipe burst + powerful water spray"),
  mkShot(13, 810, 870, "day", "Low-Angle Violent Shake (Cracking Wall)", "Stone cracking + light crumble"),
  mkShot(14, 870, 930, "day", "Fast Horizontal Tracking (18 Workers Line)", "Synchronised steps + start whistle"),
  mkShot(15, 930, 990, "day", "Low-Angle Slight Tilt Up (Jacks Lift the Building)", "Hydraulic pump hiss + metal settle clunk"),
  mkShot(16, 990, 1065, "day", "Slow Orbit + Time-Lapse Sky (A Month of Turning)", "Fast calendar page flips + time wind"),
  mkShot(17, 1065, 1140, "day", "ECU Slow Push-in (Ruler: 15 IN/HR)", "Slow clock tick + faint rolling hum"),
  mkShot(18, 1140, 1215, "day", "Soft Interior Tracking (Coffee & Phones)", "Quiet coffee sip + phone rings & office ambience"),
  mkShot(19, 1215, 1290, "day", "Close-Up Push-in (Still Coffee Surface)", "Gentle quiet + faint clock tick"),
  // ---- BEAT 4: CROSS-SECTION / X-RAY REVEAL (SHOTS 20-22 ONLY) ----
  mkShot(20, 1290, 1350, "dusk", "Cross-Section Push-in (Three Secrets Overview)", "X-Ray hum + 3 UI pops"),
  mkShot(21, 1350, 1410, "dusk", "X-Ray CU Push-in (Rollers Under Columns)", "Continuous smooth metal glide"),
  mkShot(22, 1410, 1485, "dusk", "X-Ray Underground Tracking (Flexible Pipes)", "Light water flow + flexing rubber/metal"),
  // ---- NORMAL 3D WORLD RESUMES (SHOTS 23-26) ----
  mkShot(23, 1485, 1590, "day", "Medium Orbit (Moving Entrance Bridge)", "Footsteps on metal + light bridge wheels"),
  mkShot(24, 1590, 1665, "golden", "Top-Down Pull-back (Settled at 90°)", "Soft heavy settle + completion chime"),
  mkShot(25, 1665, 1725, "day", "ECU Push-in (Corner Meets the Blueprint Line)", "Sharp precision ding"),
  mkShot(26, 1725, TOTAL, "golden", "Wide Dramatic Pull-back (New HQ Rises, Golden)", "Clear phone ring + deep closing boom (no music)"),
];

export const XFADE: Record<number, number> = {};

export const shotAt = (f: number): ShotDef =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) {
      return [
        { id: s.id - 1, alpha: 1 },
        { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) },
      ];
    }
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type BuildingState = {
  lift: number;  // metres the building is raised on its jacks/rollers
  rot: number;   // rotation around its centre, radians (0 -> PI/2 across the story)
  drift: number; // small lateral slide used in shot 3
};

/** Pose of the hero building per shot & time (only shots at X_SITE show it) */
export const buildingState = (id: number, t: number): BuildingState => {
  const f = t * FPS;
  let lift = 0.35;
  let rot = 0;
  let drift = 0;
  if (id === 1 || id === 2) {
    // Shots 1-2: the building is jacked up off its foundations (brief: "raised
    // slightly", jacks cranking beneath it) so the roller bed is exposed for
    // the shot-2 ECU; it settles back onto the bed for the shot-3 slide.
    lift = 0.85;
  } else if (id === 3) {
    // Shot 3: the whole mass creeps sideways and just begins its arc
    const u = smooth((f - 120) / 60);
    drift = 0.5 * u;
    rot = 0.03 * u;
  } else if (id === 15) {
    // Shot 15: jacks pump the building up off its foundations onto the rollers
    lift = 0.35 * smooth((f - 930) / 45);
    rot = 0;
  } else if (id === 16) {
    // Shot 16: a month of turning compressed — the arc visibly progresses
    rot = 0.12 + 0.63 * smooth((f - 990) / 75);
  } else if (id === 17) {
    rot = 0.75;
  } else if (id >= 24) {
    // Settled: lowered onto the new foundation at exactly 90 degrees
    lift = 0.04;
    rot = Math.PI / 2;
  }
  return { lift, rot, drift };
};

// ---------------- camera system ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };

const lerp3 = (a: V3, b: V3, u: number): V3 => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
  a[2] + (b[2] - a[2]) * u,
];

const moveCam = (
  f: number,
  a: number,
  b: number,
  pos0: V3,
  pos1: V3,
  look0: V3,
  look1: V3,
  fov0 = 40,
  fov1 = 40,
  roll0 = 0,
  roll1 = 0,
  linear = false,
): Cam => {
  const raw = clamp01((f - a) / Math.max(1, b - a));
  // Blend linear + smooth so velocity is non-zero even at the very first and last frames of every shot
  const u = linear ? raw : 0.35 * raw + 0.65 * smooth(raw);
  return {
    pos: lerp3(pos0, pos1, u),
    look: lerp3(look0, look1, u),
    fov: fov0 + (fov1 - fov0) * u,
    roll: roll0 + (roll1 - roll0) * u,
  };
};

const orbitCam = (
  f: number,
  a: number,
  b: number,
  center: V3,
  r0: number,
  r1: number,
  ang0: number,
  ang1: number,
  h0: number,
  h1: number,
  fov0 = 38,
  fov1 = 36,
  roll0 = 0,
  roll1 = 0,
): Cam => {
  const raw = clamp01((f - a) / Math.max(1, b - a));
  const u = 0.35 * raw + 0.65 * smooth(raw);
  const r = r0 + (r1 - r0) * u;
  const ang = ang0 + (ang1 - ang0) * u;
  const h = h0 + (h1 - h0) * u;
  return {
    pos: [center[0] + Math.sin(ang) * r, center[1] + h, center[2] + Math.cos(ang) * r],
    look: [center[0], center[1] + 0.1 * (1 - u), center[2]],
    fov: fov0 + (fov1 - fov0) * u,
    roll: roll0 + (roll1 - roll0) * u,
  };
};

// Camera shake kicks on the imagination beats (Shot 12 pipe burst, Shot 13 wall crack)
const KICKS: [number, number, number][] = [
  [25.55, 0.85, 15], // Shot 12: imagined pipe bursts under 11,000 tons (~f766)
  [26.10, 0.50, 10], // Shot 12: secondary spray shudder
  [27.85, 0.95, 16], // Shot 13: brick wall cracks open (~f835)
  [28.40, 0.55, 10], // Shot 13: crumble settle
];

export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g, len] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < len) a += g * (n % 2 ? -1 : 1) * (1 - n / len) ** 1.35;
  }
  return a;
};

const rawCamAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1] ?? SHOTS[0];
  const { a, b } = s;
  switch (id) {
    // 01 | 0.0–2.0 | Low-Angle Push-in سريع: عمال يلفون الكوريكات تحت عمارة مرفوعة على البكر
    case 1:
      return moveCam(f, a, b, [13.5, 3.0, 20.0], [9.5, 2.5, 14.5], [-0.6, 2.9, 0], [-0.6, 2.5, 0], 48, 42, -0.02, 0);

    // 02 | 2.0–4.0 | ECU + Pan جانبي: البكرات الفولاذية تدور ببطء تحت العوارض الخشبية
    case 2:
      return moveCam(f, a, b, [9.2, 0.62, 5.4], [9.2, 0.62, 1.4], [2.0, 0.38, 3.5], [2.0, 0.38, 3.3], 36, 34, 0, 0, true);

    // 03 | 4.0–6.0 | Wide + Tracking بطيء: المبنى كله ينزلق على الأرضية الخرسانية
    case 3:
      return moveCam(f, a, b, [-16.5, 6.8, 16.8], [-6.5, 6.0, 15.2], [0, 8.2, 0], [0.4, 8.0, 0], 46, 42, 0, 0);

    // 04 | 6.0–9.0 | Top-Down + Dolly-in: مخطط أزرق ولافتة 1930 على طاولة المخططات (X_PLAN)
    case 4:
      return moveCam(f, a, b, [X_PLAN + 1.5, 27, 9.5], [X_PLAN + 0.5, 18.5, 5.5], [X_PLAN, 0, -0.5], [X_PLAN, 0, -0.5], 44, 40, 0, 0);

    // 05 | 9.0–11.5 | Pass-Through عبر النافذة: قاعة السنترال المزدحمة بالموظفين (X_OFFICE)
    case 5:
      return moveCam(f, a, b, [X_OFFICE + 2.5, 3.4, 15.5], [X_OFFICE + 0.5, 2.7, 3.5], [X_OFFICE, 2.2, -4], [X_OFFICE - 0.5, 2.0, -5], 44, 40, 0, 0);

    // 06 | 11.5–14.0 | Medium + Orbit سريع: صف عاملات السنترال ولوحات تومض (X_SWITCH)
    case 6:
      return orbitCam(f, a, b, [X_SWITCH, 1.9, -2.5], 10.5, 8.6, -0.52, 0.42, 1.15, 0.95, 42, 38);

    // 07 | 14.0–16.0 | Two-Shot + Zoom-in: مهندسا الهد وعلامة X الحمراء وكرة الهدم (X_MEET)
    case 7:
      return moveCam(f, a, b, [X_MEET + 0.3, 2.5, 13.5], [X_MEET + 0.2, 2.2, 9.5], [X_MEET + 0.1, 1.9, -0.8], [X_MEET + 0.1, 1.85, -0.8], 44, 36, 0, 0);

    // 08 | 16.0–18.5 | Close-Up + Push-in: البطل يمسح علامة X من على المخطط
    case 8:
      return moveCam(f, a, b, [X_MEET + 0.6, 2.0, 5.2], [X_MEET + 0.35, 1.9, 3.3], [X_MEET, 1.8, -0.6], [X_MEET, 1.78, -0.6], 36, 29, 0, -0.02);

    // 09 | 18.5–21.0 | Top-Down + الكاميرا تلف 90 درجة: مجسم المبنى يدور فوق السهم الأخضر (X_PLAN)
    case 9:
      return moveCam(f, a, b, [X_PLAN - 1.9, 21, 5.8], [X_PLAN - 2.4, 18, 3.3], [X_PLAN - 2.9, 0, -1.7], [X_PLAN - 2.9, 0, -1.7], 42, 38, 0, -Math.PI / 2);

    // 10 | 21.0–23.0 | Medium + Push-in سريع: موظف يرد على التليفون وساعة المكتب تدور (X_OFFICE)
    case 10:
      return moveCam(f, a, b, [X_OFFICE - 3.4, 2.2, 6.8], [X_OFFICE - 2.2, 2.0, 4.6], [X_OFFICE - 4.6, 1.8, 0.5], [X_OFFICE - 4.6, 1.75, 0.5], 38, 31, 0, 0);

    // 11 | 23.0–24.5 | Wide + Zoom: بقية المهندسين ينفجرون ضحكاً (X_MEET)
    case 11:
      return moveCam(f, a, b, [X_MEET - 4.5, 2.7, 12.5], [X_MEET - 1.2, 2.2, 7.6], [X_MEET + 0.5, 1.8, -0.5], [X_MEET + 0.5, 1.8, -0.5], 44, 30, -0.02, 0.02);

    // 12 | 24.5–27.0 | Medium + Shake: ميزان ضخامة والمواسير تنفجر تحت الثقل (X_IMAGINE)
    case 12:
      return moveCam(f, a, b, [X_IMAGINE - 3.4, 4.2, 16.5], [X_IMAGINE - 2.4, 3.7, 13.0], [X_IMAGINE + 1.55, 4.1, 0], [X_IMAGINE + 1.55, 4.1, 0], 48, 44, 0.03, -0.03);

    // 13 | 27.0–29.0 | Low-Angle + Shake عنيف: شقوق تتسع في جدار طوبي (X_IMAGINE, wall at x+10)
    case 13:
      return moveCam(f, a, b, [X_IMAGINE + 10.5, 1.1, 9.8], [X_IMAGINE + 10.2, 1.6, 8.2], [X_IMAGINE + 10, 3.2, 0], [X_IMAGINE + 10, 3.5, 0], 44, 40, 0.04, -0.04);

    // 14 | 29.0–31.0 | Tracking أفقي سريع: صف 18 عاملاً حول قاعدة العمارة
    case 14:
      return moveCam(f, a, b, [-11.5, 2.1, 16.5], [9.5, 2.1, 16.5], [-9.5, 1.9, 6.8], [11.5, 1.9, 6.8], 44, 42, 0, 0, true);

    // 15 | 31.0–33.0 | Low-Angle + Tilt Up خفيف: الكوريكات ترفع العمارة على البكر
    // Two-phase blend: tight on the pumping worker + jack, then from ~f955 it eases back low & wide
    // (full by f987) to show the raised skirt, the jack row and the grown gap. Both rigs keep moving,
    // so velocity is never zero. (Opus 5.5 patch via Antigravity, applied verbatim.)
    case 15: {
      const tight = moveCam(f, a, b, [6.4, 0.9, 9.6], [5.6, 1.7, 8.4], [0, 2.2, 0], [0, 3.6, 0], 44, 40, 0, 0);
      const wide = moveCam(f, a, b, [5.0, 1.0, 14.0], [3.4, 1.05, 18.5], [1.8, 1.6, 4.5], [1.3, 1.5, 4.5], 46, 48, 0, 0);
      const w = smooth((f - 955) / 32);
      return {
        pos: lerp3(tight.pos, wide.pos, w),
        look: lerp3(tight.look, wide.look, w),
        fov: tight.fov + (wide.fov - tight.fov) * w,
        roll: 0,
      };
    }

    // 16 | 33.0–35.5 | Orbit بطيء + Time-Lapse: تقويم يطير والعمارة تلف تدريجياً
    case 16:
      return orbitCam(f, a, b, [2.9, 5.7, 0], 29, 27, -0.55, 0.38, 5.0, 7.5, 48, 44);

    // 17 | 35.5–38.0 | ECU: مسطرة قياس بجانب بكرة تصل لعلامة 15 IN/HR
    case 17:
      return moveCam(f, a, b, [7.2, 2.3, 14.8], [6.2, 1.8, 12.6], [6.5, 0.62, 5.9], [6.3, 0.6, 5.7], 38, 34, 0, 0);

    // 18 | 38.0–40.5 | Tracking داخلي ناعم: موظف بالقهوة والتليفون والمنظر يتحرك بره الشباك (X_OFFICE)
    case 18:
      return moveCam(f, a, b, [X_OFFICE - 6.5, 2.4, 6.2], [X_OFFICE + 1.5, 2.3, 4.6], [X_OFFICE - 1.5, 1.9, 0.8], [X_OFFICE + 3.4, 1.9, 0.8], 40, 37, 0, 0, true);

    // 19 | 40.5–43.0 | Close-Up: سطح القهوة ساكن كالمرآة (X_OFFICE, cup desk near window)
    case 19:
      return moveCam(f, a, b, [X_OFFICE + 3.9, 1.85, 3.4], [X_OFFICE + 3.55, 1.68, 2.5], [X_OFFICE + 3.2, 1.32, 0.9], [X_OFFICE + 3.2, 1.3, 0.9], 34, 29, 0, 0);

    // ---- BEAT 4: CROSS-SECTION / X-RAY (SHOTS 20–22 ONLY, AT X_XRAY = 270) ----
    // 20 | 43.0–45.0 | Cross-Section: ثلاث نقاط مضيئة مرقمة تحت العمارة الشبحية
    case 20:
      return moveCam(f, a, b, [X_XRAY + 7.6, 2.6, 5.4], [X_XRAY + 6.8, 2.2, 4.9], [X_XRAY - 2.0, -1.4, -0.3], [X_XRAY - 2.0, -1.4, -0.3], 52, 48, 0, 0);

    // 21 | 45.0–47.0 | X-Ray CU: قاعدة العمود تنزلق فوق صف البكرات الملساء
    case 21:
      return moveCam(f, a, b, [X_XRAY + 0.6, 1.5, 5.6], [X_XRAY + 0.1, 1.3, 4.9], [X_XRAY - 2.4, -1.7, 0], [X_XRAY - 2.4, -1.7, 0], 38, 34, 0, 0);

    // 22 | 47.0–49.5 | X-Ray Tracking تحت الأرض: مواسير مرنة ملونة تتمدد مع اللفة
    case 22:
      return moveCam(f, a, b, [X_XRAY - 6.5, -0.9, 2.7], [X_XRAY + 5.5, -0.9, 2.5], [X_XRAY - 2.5, -2.45, 0.15], [X_XRAY + 2.0, -2.45, 0.15], 42, 40, 0, 0, true);

    // ---- NORMAL 3D WORLD RESUMES ----
    // 23 | 49.5–53.0 | Medium + Orbit: كوبري حديد متحرك عند الباب والموظفون يعبرون (X_DOOR)
    case 23:
      return orbitCam(f, a, b, [X_DOOR, 1.7, 1.5], 10.5, 8.2, -0.62, 0.5, 1.3, 1.0, 42, 38);

    // 24 | 53.0–55.5 | Top-Down + Pull-back: العمارة رست في زاويتها الجديدة 90 درجة
    case 24:
      return moveCam(f, a, b, [7, 17, 19], [10, 24, 27], [1.0, 1.5, 0], [1.0, 1.5, 0], 44, 46, 0, 0);

    // 25 | 55.5–57.5 | ECU: حافة العمارة تنطبق على خط المخطط المضيء بالملي
    case 25:
      return moveCam(f, a, b, [9.2, 1.6, 11.0], [8.1, 1.35, 9.6], [4.5, 0.5, 6.5], [4.5, 0.45, 6.5], 36, 30, 0, 0);

    // 26 | 57.5–59.2 | Wide Pull-back درامي: المقر الجديد يرتفع بجانب العمارة المنقولة، غروب ذهبي
    case 26:
    default:
      return moveCam(f, a, b, [-7.5, 10.5, 31], [-11, 13.5, 45], [5, 11.0, 0], [5, 12.0, 0], 46, 41, 0, 0);
  }
};

export const camAt = (id: number, f: number): Cam => {
  const c = rawCamAt(id, f);
  const a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (4 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return {
    ...c,
    look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.7 * m, c.look[2] + (d[0] / h) * m],
    roll: c.roll + a * 0.006,
  };
};

// ---------------- lens: depth of field ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };

export const dofAt = (f: number) => {
  const s = shotAt(f);
  const c = camAt(s.id, f);
  // Close-ups and ECUs get crisp shallow DOF; wide establishing shots stay sharp
  const cuShots = new Set([8, 10, 17, 18, 19, 21, 22, 25]);
  const cInf = cuShots.has(s.id) ? 11 : 0;
  return { cInf, focus: (_f: number) => c.look };
};

export const focusAt = (id: number, f: number): V3 => camAt(id, f).look;

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];

// Timeline of "Otis" (Elisha Otis & the 1854 NY Crystal Palace Safety Brake Demonstration):
// 34 shots retimed to the locked voice audio (voice.wav, 146 words, 55.48 s, 1664 frames @ 30 fps).
// Governing rules (AGY_BRIEF.md):
//   1. Camera: every shot 1.3–2.5s (anchored to word timestamps) with a NAMED camera move.
//      Zero static frames anywhere — every single frame has continuous camera motion.
//   2. Cross-section / X-ray visuals ONLY in shots 23–29 (frames 1120..1456). Never earlier or later.
//   3. 3D numbers & price-tag props: 3 floors (Shot 2), ground-floor vs stairs tags (Shots 7–8),
//      rising high-rise floors & ascending price tags $ -> $$ -> $$$ -> $$$$ (Shots 31–32).
//   4. Shot 1 frame 0 is action already in progress (no title card); Shot 34 is a closed golden ending (no loop).

export const FPS = 30;
export const TOTAL = 1664;
export const D0 = 0;
export type V3 = [number, number, number];

// World X-zone centers (kept well separated so sets never photobomb each other):
export const X_PALACE = 0;    // Shots 1-3, 12-22: 1854 NY Crystal Palace glass hall & 3-story open wooden tower
export const X_STREET = -90;  // Shots 4-6: 1854 brick street & old wooden box elevator shaft (snap & crash)
export const X_APTS = -180;   // Shots 7-8: Rich ground floor parlor (-182) vs poor tall staircase (-170)
export const X_SHOP = 90;     // Shots 9-11: Otis workshop (90), laughing merchants (104), box on a thread (118)
export const X_XRAY = 180;    // Shots 23-29 ONLY: Cross-section / X-ray roof mechanism reveal rig (y = 8)
export const X_BELT = 260;    // Shot 30: Clean 3D seatbelt buckle & inertia ratchet analogy prop (y = 2.5)
export const X_CITY = 340;    // Shots 31-34: Rising high-rise building, 3D price tags & Manhattan skyscraper skyline

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
  xray: id >= 23 && id <= 29,
  sfx,
  tau: (t: number) => t,
});

export const SHOTS: ShotDef[] = [
  mkShot(1, 0, 42, "day", "Wide Fast Push-in", "High altitude wind + taut rope creak"),
  mkShot(2, 42, 85, "day", "Fast Tilt Down (3 Floors)", "High wind"),
  mkShot(3, 85, 151, "day", "Medium Push-in (Signal & Axe Rim Light)", "Rope tension + metallic blade shing"),
  mkShot(4, 151, 210, "day", "Flashback Wide Dolly-in", "Swaying wooden box creak"),
  mkShot(5, 210, 260, "day", "ECU Snap & Falling Track", "Rope fiber snap + falling whoosh"),
  mkShot(6, 260, 310, "day", "Low-Angle Push-in + Camera Shake", "Loud wooden crash + debris"),
  mkShot(7, 310, 360, "day", "Horizontal Tracking (Rich Ground Floor)", "Calm parlor murmur + clinking glasses"),
  mkShot(8, 360, 399, "day", "Fast Tilt Up (Poor Climbing Stairs)", "Hurried footsteps + heavy panting"),
  mkShot(9, 399, 451, "day", "Gentle Medium Orbit (Otis Workshop)", "Light metal hammering + tinkering"),
  mkShot(10, 451, 499, "day", "Two-Shot Zoom-in + Dutch Roll", "Short mocking laugh"),
  mkShot(11, 499, 569, "day", "ECU Push-in (Box on a Thin Thread)", "Thin thread strain creak"),
  mkShot(12, 569, 643, "day", "Wide Crane Dolly-in (Crystal Palace God Rays)", "Large exhibition crowd murmur"),
  mkShot(13, 643, 690, "day", "Rising Vertical Tracking", "Pulleys & ropes + heartbeat begins"),
  mkShot(14, 690, 729, "day", "High-Angle Tilt & Push-in", "Accelerating heartbeat"),
  mkShot(15, 729, 756, "day", "Fast ECU Blade Track", "Heavy axe blade whoosh"),
  mkShot(16, 756, 792, "day", "Impact ECU + Violent Shake + Flash", "Loud axe CHOP + rope SNAP"),
  mkShot(17, 792, 820, "day", "ECU Pull-back (Severed Rope Recoil)", "Whipping rope recoil"),
  mkShot(18, 820, 869, "day", "Medium Drop Track + Jolt Shake", "Short drop whoosh + wood screech"),
  mkShot(19, 869, 930, "day", "Wide to Fast Zoom-in (Crowd Scream)", "Collective crowd scream"),
  mkShot(20, 930, 990, "day", "Low-Angle Push-in (Frozen Mid-Air)", "Sharp metallic CLANK then silence"),
  mkShot(21, 990, 1049, "day", "Close-Up Push-in (Hat Tip)", "Dramatic silence + soft hat touch"),
  mkShot(22, 1049, 1120, "day", "Medium Pull-back (All Safe Gesture)", "Applause begins and swells"),
  // ---- BEAT 4: X-RAY / CROSS-SECTION REVEAL (SHOTS 23-29 ONLY) ----
  mkShot(23, 1120, 1160, "dusk", "Push-in to Platform Roof (X-Ray Transition)", "Soft X-Ray hum"),
  mkShot(24, 1160, 1230, "dusk", "Cross-Section Orbit Push-in (Leaf Spring & Tension)", "Metallic tension + UI pop"),
  mkShot(25, 1230, 1281, "dusk", "X-Ray CU Push-in (Compressed Leaf Spring)", "Low mechanical hum"),
  mkShot(26, 1281, 1320, "dusk", "X-Ray Lateral Track (Green Clearance Gap)", "Smooth mechanical glide"),
  mkShot(27, 1320, 1363, "dusk", "X-Ray Tilt Push-in (Rope Snaps Again)", "Muted mechanical snap"),
  mkShot(28, 1363, 1406, "dusk", "ECU Slow-Mo Push-in (Spring Releases Claws)", "Heavy spring release"),
  mkShot(29, 1406, 1456, "dusk", "ECU Impact Push-in (Claws Bite Ratchet Teeth)", "Loud metallic LOCK CLACK"),
  // ---- NORMAL 3D WORLD RESUMES (SHOTS 30-34) ----
  mkShot(30, 1456, 1500, "day", "Clean 3D Prop Orbit Push-in (Seatbelt Lock)", "Crisp seatbelt click"),
  mkShot(31, 1500, 1546, "day", "Fast Tilt Up (Rising Building Floors)", "Ascending floor ding"),
  mkShot(32, 1546, 1579, "day", "Rising Track Push-in (3D Price Tags)", "Cash register cha-ching"),
  mkShot(33, 1579, 1620, "day", "Wide Crane Pull-back (Skyscrapers Grow)", "Ascending urban growth rumble"),
  mkShot(34, 1620, TOTAL, "golden", "Closing Wide Push-in (Golden Skyline)", "Deep closing boom"),
];

export const XFADE: Record<number, number> = {};
// 4-frame impact flash right on the axe chop at 25.20s (frame 756, Shot 16)
export const FLASH_AT = 756;

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

export type BridgeState = {
  platY: number;     // Crystal Palace platform floor height (m)
  ropeCut: boolean;  // Whether the main hoist rope is severed
  clawsOut: number;  // 0 = retracted, 1 = locked into ratchet teeth
  bounce: number;
  drop: number;
  snap: number;
  collapsed: boolean;
};

/** Height and mechanical state of the Crystal Palace demonstration platform per shot & time */
export const bridgeState = (id: number, t: number): BridgeState => {
  const f = t * FPS;
  let platY = 12.0;
  let ropeCut = false;
  let clawsOut = 0;

  if (id === 1) {
    // Shot 1: platform already in motion rising into 3rd-floor position (action in progress at f0)
    const u = smooth((f - 0) / 42);
    platY = 11.2 + 0.8 * u;
  } else if (id === 2 || id === 3) {
    platY = 12.0;
  } else if (id === 12) {
    platY = 4.0 + 2.0 * smooth((f - 569) / 74);
  } else if (id === 13) {
    // Shot 13: platform rises in front of the crowd from Floor 1 (4.2m) to Floor 3 (11.2m)
    const u = smooth((f - 643) / 47);
    platY = 4.2 + 7.0 * u;
  } else if (id === 14 || id === 15) {
    platY = 12.0;
  } else if (id === 16 || id === 17) {
    platY = 12.0;
    ropeCut = true;
    clawsOut = smooth((f - 756) / 18);
  } else if (id === 18) {
    // Shot 18: platform drops a few inches/centimetres suddenly and locks hard!
    ropeCut = true;
    const u = easeOut((f - 820) / 14);
    const bounce = Math.sin(clamp01((f - 825) / 22) * Math.PI * 3) * 0.06 * (1 - clamp01((f - 825) / 22));
    platY = 12.0 - 0.42 * u + bounce;
    clawsOut = 1;
  } else if (id >= 19 && id <= 22) {
    platY = 11.58;
    ropeCut = true;
    clawsOut = 1;
  }

  return {
    platY,
    ropeCut,
    clawsOut,
    bounce: 0,
    drop: ropeCut ? 1 : 0,
    snap: ropeCut ? 1 : 0,
    collapsed: false,
  };
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

// Camera shake kicks on impact beats (Shot 5 snap, Shot 6 crash, Shot 16 chop, Shot 18 drop, Shot 20 lock, Shot 29 X-ray lock)
const KICKS: [number, number, number][] = [
  [7.40, 0.45, 8],   // Shot 5: frayed rope snap
  [8.70, 0.95, 16],  // Shot 6: wooden box crash impact
  [9.35, 0.65, 14],  // Shot 6: secondary crash settle (active across midpoint f285 = 9.50s)
  [25.20, 1.15, 22], // Shot 16: «طاخ!» axe chop impact (active across midpoint f774 = 25.80s)
  [27.45, 0.80, 14], // Shot 18: platform sudden drop jolt
  [28.00, 0.50, 12], // Shot 18: brake catch shudder (active across midpoint f844 = 28.13s)
  [31.05, 0.75, 10], // Shot 20: metallic clank lock
  [46.95, 0.70, 12], // Shot 29: X-ray claw bite lock
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
    // 01 | 0.00–1.40 | Wide Push-in سريع: منصة معلقة في برج مفتوح، أوتيس واقف عليها، الحركة بدأت بالفعل
    case 1:
      return moveCam(f, a, b, [4.6, 10.2, 12.8], [2.8, 11.8, 7.6], [0, 12.5, 0], [0, 13.1, 0], 45, 38, -0.02, 0);

    // 02 | 1.40–2.82 | Tilt Down سريع: ثلاثة طوابق تحت المنصة، إحساس الارتفاع (3D floor numbers 3, 2, 1 on left post)
    case 2:
      return moveCam(f, a, b, [-3.2, 14.6, 11.5], [-2.6, 8.8, 10.2], [-0.8, 12.2, 0], [-0.8, 4.2, 0], 44, 42, 0.02, -0.02);

    // 03 | 2.82–5.03 | Medium Push-in: أوتيس يشاور؛ الفأس مرفوعة فوق الحبل (Rim Light على النصل)
    case 3:
      return moveCam(f, a, b, [2.2, 13.0, 6.8], [1.2, 13.8, 4.3], [0.25, 13.9, 0], [0.35, 14.4, 0], 39, 33, 0, -0.025);

    // 04 | 5.03–7.00 | Flashback Wide Dolly-in: شارع 1854 ومصعد خشبي مهتز (X_STREET = -90)
    case 4:
      return moveCam(f, a, b, [X_STREET + 4.8, 5.2, 14.5], [X_STREET + 2.2, 7.2, 8.6], [X_STREET, 7.5, 0], [X_STREET, 8.6, 0], 44, 38, 0.03, -0.03);

    // 05 | 7.00–8.65 | ECU: حبل مهترئ ينقطع (Snap ~7.4) والكاميرا تلحق الصندوق هابطاً
    case 5:
      return moveCam(f, a, b, [X_STREET + 0.5, 11.9, 3.1], [X_STREET + 0.9, 8.6, 3.9], [X_STREET, 11.0, 0], [X_STREET, 7.4, 0], 40, 38, -0.03, 0.04);

    // 06 | 8.65–10.32 | Low-Angle: الصندوق يرتطم ويتحطم، غبار وخشب متطاير + Camera Shake
    case 6:
      return moveCam(f, a, b, [X_STREET - 2.6, 0.85, 6.2], [X_STREET - 1.6, 0.65, 4.4], [X_STREET, 1.3, 0], [X_STREET, 0.9, 0], 44, 38, 0.05, -0.04);

    // 07 | 10.32–12.00 | Tracking أفقي: أغنياء مرتاحون في دور أرضي فاخر، بطاقة سعر صغيرة (X_APTS = -180)
    case 7:
      return moveCam(f, a, b, [X_APTS - 5.2, 2.1, 7.8], [X_APTS + 1.4, 2.1, 7.2], [X_APTS - 4.0, 1.6, 0], [X_APTS + 0.6, 1.6, 0], 38, 36, 0, 0, true);

    // 08 | 12.00–13.31 | Tilt Up سريع: فقراء منهكون يصعدون سلالم طويلة، قطرات عرق (Stairwell at X_APTS + 10 = -170)
    case 8:
      return moveCam(f, a, b, [X_APTS + 10.2, 2.2, 8.2], [X_APTS + 9.8, 8.8, 7.2], [X_APTS + 10, 2.8, 0], [X_APTS + 10, 10.2, 0], 42, 38, -0.03, 0.03);

    // 09 | 13.31–15.04 | Medium Orbit خفيف: أوتيس في ورشته يركّب جهاز الفرامل في سقف المنصة، مخطط بجانبه (X_SHOP = 90)
    case 9:
      return orbitCam(f, a, b, [X_SHOP + 0.4, 1.65, 0], 5.6, 4.4, -0.38, 0.32, 0.6, 0.4, 38, 35);

    // 10 | 15.04–16.64 | Two-Shot Zoom-in: تاجران يضحكان باستهزاء (X_SHOP + 14 = 104)
    case 10:
      return moveCam(f, a, b, [X_SHOP + 14.2, 1.75, 5.8], [X_SHOP + 14.0, 1.68, 3.8], [X_SHOP + 14.0, 1.55, 0], [X_SHOP + 14.0, 1.6, 0], 38, 30, -0.09, -0.04);

    // 11 | 16.64–18.96 | ECU: علبة صغيرة تتدلى من خيط رفيع يتمايل (X_SHOP + 28 = 118, y = 6.0)
    case 11:
      return moveCam(f, a, b, [X_SHOP + 28.6, 6.6, 4.5], [X_SHOP + 27.7, 6.3, 2.9], [X_SHOP + 28, 6.2, 0], [X_SHOP + 28, 6.0, 0], 36, 30, 0.04, -0.05);

    // 12 | 18.96–21.44 | Wide: قاعة قصر الكريستال الزجاجية بأشعة شمس (God Rays) والبرج في المنتصف
    case 12:
      return moveCam(f, a, b, [-11.5, 6.5, 22.5], [-6.8, 4.8, 15.5], [0, 7.5, 0], [0, 8.2, 0], 48, 42, 0, 0);

    // 13 | 21.44–23.00 | Tracking صاعد: المنصة تصعد بأوتيس أمام الحشد
    case 13:
      return moveCam(f, a, b, [3.6, 3.8, 9.2], [2.6, 9.8, 7.6], [0, 4.8, 0], [0, 11.8, 0], 42, 38, 0, 0);

    // 14 | 23.00–24.31 | High-Angle من المنصة: وجوه الجمهور المتوترة تحت + الفأس تُرفع
    case 14:
      return moveCam(f, a, b, [-1.4, 16.4, 3.4], [-0.9, 15.6, 2.4], [0.5, 11.8, -0.5], [0.6, 12.8, -0.2], 46, 40, 0.03, -0.02);

    // 15 | 24.31–25.20 | ECU سريع: النصل يهوي نحو الحبل المشدود
    case 15:
      return moveCam(f, a, b, [0.85, 15.55, 2.45], [0.35, 15.05, 1.65], [0.25, 15.15, 0], [0.05, 14.85, 0], 34, 28, -0.05, 0.06);

    // 16 | 25.20–26.40 | طاخ! Impact ECU + Shake عنيف + ومضة: النصل يقطع الحبل، ألياف تتطاير
    case 16:
      return moveCam(f, a, b, [-0.35, 14.95, 1.75], [0.25, 14.8, 2.15], [0, 14.85, 0], [0, 14.8, 0], 30, 34, 0.08, -0.04);

    // 17 | 26.40–27.33 | الحبل اتقطع: طرفا الحبل يتطايران وينكمشان بعيداً
    case 17:
      return moveCam(f, a, b, [0.4, 14.85, 2.2], [0.9, 14.7, 3.3], [0, 14.85, 0], [0, 14.75, 0], 34, 38, -0.03, 0.02);

    // 18 | 27.33–28.97 | والمنصة هبدت لتحت كام سنتي: المنصة تهبط سنتيمترات والكاميرا تهبط معها + Shake
    case 18:
      return moveCam(f, a, b, [-2.2, 13.8, 6.2], [-1.6, 12.6, 5.2], [0, 13.4, 0], [0, 12.7, 0], 38, 35, 0.04, -0.02);

    // 19 | 28.97–31.00 | والجمهور صرخ من الرعب: Wide → Zoom سريع: الحشد يصرخ، أيدٍ على الرؤوس
    case 19:
      return moveCam(f, a, b, [0.4, 3.8, 12.8], [0.1, 2.1, 7.6], [0, 1.4, 4.2], [0, 1.45, 4.5], 44, 28, -0.03, 0.04);

    // 20 | 31.00–32.99 | بس في ثانية المنصة اتسمّرت في الهوا: Low-Angle: المنصة تتجمد فجأة في الهواء، شرار خفيف عند السكة
    case 20:
      return moveCam(f, a, b, [-2.0, 7.8, 7.2], [-1.1, 9.2, 5.4], [0, 12.8, 0.3], [0, 13.1, 0.3], 42, 35, 0, 0);

    // 21 | 32.99–34.98 | أوتيس عدّل برنيطته وقال ببرود: Close-Up: أوتيس يعدّل قبعته بابتسامة واثقة هادئة
    case 21:
      return moveCam(f, a, b, [0.65, 13.55, 3.6], [0.25, 13.6, 2.55], [0, 13.45, 0], [0, 13.52, 0], 33, 28, 0, 0);

    // 22 | 34.98–37.33 | كل شيء تمام يا سادة، كله آمن!: Medium Pull-back: أوتيس يشير بيديه للجمهور المذهول
    case 22:
      return moveCam(f, a, b, [-0.8, 13.2, 4.2], [-3.8, 9.6, 10.8], [0, 13.1, 0], [0, 9.5, 1.2], 35, 44, 0, 0);

    // ---- BEAT 4: X-RAY / CROSS-SECTION REVEAL (SHOTS 23–29 ONLY, AT X_XRAY = 180, y = 8) ----
    // 23 | 37.33–38.65 | شوف يا سيدي: Push-in نحو سقف المنصة، بداية تحوّل X-Ray
    case 23:
      return moveCam(f, a, b, [X_XRAY - 1.2, 7.4, 4.3], [X_XRAY - 0.45, 7.9, 2.8], [X_XRAY, 8.1, 0], [X_XRAY, 8.12, 0], 38, 30, 0, 0);

    // 24 | 38.65–41.00 | سقف المنصة فيه سوستة حديد مشدودة بوزن الحبل: Cross-Section: السوستة الورقية + أسهم شد خضراء لأعلى
    case 24:
      return orbitCam(f, a, b, [X_XRAY, 8.3, 0], 2.7, 2.2, -0.28, 0.5, 0.62, 0.72, 34, 30);

    // 25 | 41.00–42.69 | طول ما الحبل سليم السوستة مضغوطة: X-Ray CU: السوستة مضغوطة تحت الشد
    case 25:
      return moveCam(f, a, b, [X_XRAY + 1.2, 9.4, 2.4], [X_XRAY + 0.7, 9.0, 1.9], [X_XRAY, 8.2, 0], [X_XRAY, 8.2, 0], 30, 26, 0.02, -0.02);

    // 26 | 42.69–44.00 | والكلابات بعيدة: X-Ray: فجوة مضيئة بالأخضر بين الكلابات والسكة المسننة
    case 26:
      return moveCam(f, a, b, [X_XRAY + 0.7, 8.1, 2.9], [X_XRAY + 1.0, 8.0, 2.5], [X_XRAY + 1.45, 7.95, 0], [X_XRAY + 1.6, 7.92, 0], 30, 27, 0, 0);

    // 27 | 44.00–45.44 | وأول ما الحبل يتقطع: X-Ray: الحبل ينقطع مرة أخرى (تكرار آلي)
    case 27:
      return moveCam(f, a, b, [X_XRAY - 0.2, 9.4, 2.1], [X_XRAY + 0.1, 9.2, 1.6], [X_XRAY, 9.35, 0], [X_XRAY, 9.25, 0], 30, 26, -0.03, 0.03);

    // 28 | 45.44–46.87 | السوستة تفرد وتغرز الكلابات: ECU Slow-Mo: السوستة تنفرد والكلابات تنطلق نحو السكة
    case 28:
      return moveCam(f, a, b, [X_XRAY - 0.1, 8.1, 2.3], [X_XRAY + 0.2, 8.0, 1.8], [X_XRAY + 0.2, 8.1, 0], [X_XRAY + 0.5, 8.0, 0], 30, 26, 0, 0);

    // 29 | 46.87–48.52 | في سنون السكة فتفرمل فوراً: ECU: الكلابات تعضّ سنون السكة وتتوهج لحظة القفل
    case 29:
      return moveCam(f, a, b, [X_XRAY + 1.4, 7.98, 1.7], [X_XRAY + 1.65, 7.92, 1.3], [X_XRAY + 1.78, 7.9, 0], [X_XRAY + 1.82, 7.88, 0], 26, 22, 0.03, 0);

    // ---- NORMAL 3D WORLD RESUMES ----
    // 30 | 48.52–50.00 | زي قفل حزام الأمان: Prop نظيف: قفل حزام أمان 3D ينغلق عند الشد (X_BELT = 260, y = 2.5)
    case 30:
      return moveCam(f, a, b, [X_BELT - 0.1, 2.8, 6.8], [X_BELT - 0.05, 2.65, 5.9], [X_BELT - 0.1, 2.5, 0], [X_BELT - 0.1, 2.5, 0], 40, 36, 0, 0);

    // 31 | 50.00–51.52 | ومن يومها الطوابق العالية: Fast Tilt Up: مبنى يرتفع طابقاً فوق طابق (X_CITY = 340)
    case 31:
      return moveCam(f, a, b, [X_CITY - 4.5, 3.2, 16.5], [X_CITY - 2.8, 13.5, 14.5], [X_CITY, 3.5, 0], [X_CITY, 18.5, 0], 44, 38, 0, 0);

    // 32 | 51.52–52.63 | بقت أغلى شقق: بطاقات الأسعار تتبدل صعوداً كلما ارتفعنا
    case 32:
      return moveCam(f, a, b, [X_CITY + 5.8, 12.5, 11.2], [X_CITY + 4.4, 20.2, 8.8], [X_CITY + 3.2, 13.2, 0], [X_CITY + 3.2, 21.0, 0], 38, 32, -0.02, 0.02);

    // 33 | 52.63–54.00 | وناطحات السحاب: Pull-back: ناطحات سحاب تنمو حول المدينة
    case 33:
      return moveCam(f, a, b, [X_CITY + 6.0, 14.0, 18.0], [X_CITY + 14.0, 22.0, 38.0], [X_CITY, 12.0, -4.0], [X_CITY, 16.0, -8.0], 42, 46, 0, 0);

    // 34 | 54.00–55.48 | اتولدت!: Wide ختامي Push-in خفيف: أفق مدينة كاملة، غروب ذهبي
    case 34:
    default:
      return moveCam(f, a, b, [X_CITY - 10.0, 18.5, 42.0], [X_CITY - 6.5, 19.8, 34.5], [X_CITY, 16.5, -10.0], [X_CITY, 18.0, -10.0], 46, 40, 0, 0);
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

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };

export const dofAt = (f: number) => {
  const s = shotAt(f);
  const c = camAt(s.id, f);
  // Close-ups and ECUs get crisp shallow DOF (10-14 px); wide establishing shots stay sharp (0-4 px)
  const cuShots = new Set([3, 5, 9, 10, 11, 15, 16, 17, 18, 21, 24, 25, 26, 27, 28, 29, 30, 32]);
  const cInf = cuShots.has(s.id) ? 11 : 0;
  return { cInf, focus: (_f: number) => c.look };
};

export const focusAt = (id: number, f: number): V3 => camAt(id, f).look;

export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];

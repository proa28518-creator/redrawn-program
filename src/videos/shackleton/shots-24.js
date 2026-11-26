// shots-24.js — Camera shot library for RicksClips-Engine 3.0.1 (hybrid, part 3)
// The third companion file next to the plugin: characters-52.js (who) + worlds-24.js
// (where + how good) + this file (how the camera moves). Gemini picks a pattern by id
// instead of inventing camera keys — faster to build, and the proven faults stay out.
// Every field comes from the engine itself: engine/camera/camera.js (Director) and the
// 26 shots of the Shackleton story (project/src/story.js), which rendered and passed
// the stills check on 2026-11-25.
// Key fields (camera.js): { t, pos, look, fov=38, roll=0, glide=0 (0 = hard cut),
//   push (%/frame; >0 push-in, <0 pull-back), move: "locked"|"push"|"pull" (0 / 0.22 / -0.22),
//   aerial, ease: "out"|"smooth"|"in"|"linear", path: [[x,y,z]...],
//   transition: "whip"|"flash"|"dissolve" (8 frames whip/dissolve, 6 flash; whipDir 1|-1),
//   light, lens: { focus: "name"|[x,y,z], px } }
// Director defaults that matter: a shot >= 1 s with no move gets a slow push-in (0.22%/frame)
// automatically — "locked" must be written explicitly. A transition replaces the glide.
// aim(target, {dist, yaw, height, fov}) and aerial(center, {height, fov, tilt, yaw}) are the
// build() helpers; shotAt() below calls them for you.

export const SHOTS = [
  // ---------- openers & closers ----------
  { id: "hook_closeup", ar: "افتتاحية قريبة", en: "Hook close-up", kind: "aim",
    dist: 2.85, yaw: 0.28, height: 0.1, fov: 36, roll: -5, move: "push", lensPx: 10,
    use: "أول لقطة في الفيلم — وجه البطل وهو ماشي", rule: "الوجه في الكادر من أول فريم، والرأس 300–430 بكسل" },
  { id: "finale_pullback", ar: "سحب نهائي واسع", en: "Finale pull-back", kind: "aim",
    dist: 5.0, yaw: 0.1, height: 0.6, fov: 42, roll: 0, move: "pull", lensPx: 10,
    use: "آخر لقطة — سحب للخلف يكشف المكان كله", rule: "السحب النهائي لازم يوري المكان، مش بس الوجه" },
  { id: "aerial_sweep", ar: "مسح جوي", en: "Aerial sweep", kind: "aerial",
    height: 15.5, tilt: 0.35, yaw: 0.2, fov: 44,
    use: "كشف المكان من فوق — جبال، بحر، مدينة", rule: "لقطة جوية واحدة لكل مكان جديد، مش أكتر" },
  { id: "top_down", ar: "من فوق لتحت", en: "Top-down", kind: "aerial",
    height: 8.0, tilt: 0.9, yaw: 0.0, fov: 42,
    use: "خريطة، طاولة، شخص نايم — رؤية من فوق", rule: "الزاوية 90 درجة تقريباً، والموضوع في النص" },
  // ---------- faces ----------
  { id: "tight_closeup", ar: "قريبة ضيقة على الوجه", en: "Tight face close-up", kind: "aim",
    dist: 2.15, yaw: 0.18, height: 0.05, fov: 34, roll: -4, move: "push", lensPx: 14,
    use: "لحظة إحساس — خوف، دهشة، إدراك", rule: "العينين في الكادر دايماً؛ لو الوجه لف، الكاميرا تلف معاه" },
  { id: "reverse_closeup", ar: "عكسية قريبة", en: "Reverse close-up", kind: "aim",
    dist: 2.75, yaw: 0.22, height: 0.08, fov: 36, roll: 4, move: "locked", lensPx: 11,
    use: "رد الشخص التاني في حوار — وش مقابل وش", rule: "العكسية لازم تكون من الناحية التانية، مش نفس الزاوية" },
  { id: "side_profile", ar: "جانبية بروفايل", en: "Side profile", kind: "aim",
    dist: 3.0, yaw: 1.57, height: 0.0, fov: 38, roll: 0, move: "push", lensPx: 10,
    use: "شخص ماشي أو باصص لقدام — بروفايل", rule: "سيب مساحة قدام الوجه في اتجاه النظر، مش وراه" },
  { id: "over_shoulder", ar: "من فوق الكتف", en: "Over-the-shoulder", kind: "offset",
    offset: [3.1, 0.35, 2.0], fov: 40, roll: -7, move: "pull", lensPx: 9,
    use: "كشف حاجة ورا البطل — شخص أو مكان غامض", rule: "الكتف في طرف الكادر بس، والموضوع المكشوف هو البطل الحقيقي" },
  { id: "two_shot", ar: "لقطة ثنائية", en: "Two-shot", kind: "aim",
    dist: 4.0, yaw: 0.0, height: 0.1, fov: 38, roll: 0, move: "push", lensPx: 10,
    use: "اتنين بيتكلموا — حوار أو مواجهة", rule: "الاتنين في الكادر، واللي بيتكلم أقرب شوية" },
  { id: "group_reaction", ar: "رد فعل جماعي", en: "Group reaction", kind: "aim",
    dist: 4.5, yaw: 0.0, height: 0.35, fov: 40, roll: 0, move: "push", lensPx: 10,
    use: "3 أو أكتر حوالين طاولة أو نار — رد فعل", rule: "كل الوشوش باينة؛ مفيش ضهر كاميرا" },
  // ---------- movement ----------
  { id: "low_track", ar: "تتبع جانبي منخفض", en: "Low side track", kind: "aim",
    dist: 3.6, yaw: -0.62, height: -0.25, fov: 38, roll: 6, move: "push", lensPx: 8,
    use: "مشي طويل، تعب، رحلة", rule: "الكاميرا ماشية معاه مش ثابتة — لو وقفت، اللقطة تموت" },
  { id: "chase_push", ar: "دفع مطاردة", en: "Chase push", kind: "aim",
    dist: 3.2, yaw: 0.0, height: 0.05, fov: 38, roll: -6, move: "push", lensPx: 10,
    use: "مطاردة، هروب، استعجال", rule: "الدفع سريع والكاميرا مايلة — الإحساس بالسرعة من الميل" },
  { id: "high_pullback", ar: "سحب من أعلى", en: "High pull-back", kind: "aim",
    dist: 6.0, yaw: 0.0, height: 3.5, fov: 44, roll: 4, move: "pull", lensPx: 10,
    use: "عزلة — شخص صغير في مكان كبير", rule: "الشخص يصغر والفراغ يكبر؛ دي لقطة العزلة" },
  { id: "doorway_glide", ar: "انزلاق من باب", en: "Doorway glide", kind: "aim",
    dist: 3.5, yaw: 0.0, height: 0.1, fov: 38, roll: 0, move: "push", glide: 30, ease: "smooth", lensPx: 10,
    use: "دخول مكان جديد من باب أو ممر", rule: "الانزلاق 30 فريم و ease smooth — مش قطع ناشف" },
  // ---------- cuts & transitions ----------
  { id: "whip_cut", ar: "قطع سوطي", en: "Whip cut", kind: "aim",
    dist: 3.4, yaw: 0.0, height: 0.1, fov: 42, roll: 9, move: "push", transition: "whip", whipDir: 1, lensPx: 10,
    use: "انتقال لمكان تاني بعيد — بحر، جزيرة، مدينة", rule: "السوط اتجاه واحد ثابت في الفيلم؛ وبدّل الاتجاه للرجوع" },
  { id: "flash_cut", ar: "قطع فلاش", en: "Flash cut", kind: "aim",
    dist: 3.4, yaw: 0.0, height: 0.1, fov: 42, roll: 0, move: "push", transition: "flash", lensPx: 10,
    use: "انتقال زمني — بعد ساعات، بعد أيام", rule: "الفلاش للزمن، والسوط للمكان — ما تخلطهمش" },
  { id: "dissolve_cut", ar: "قطع ذوبان", en: "Dissolve cut", kind: "aim",
    dist: 3.4, yaw: 0.0, height: 0.1, fov: 40, roll: 0, move: "push", transition: "dissolve", lensPx: 10,
    use: "انتقال هادي — ذكرى، حلم، تأمل", rule: "الذوبان للحالات الهادية بس؛ مش للأكشن" },
  { id: "quick_cut", ar: "قطع سريع", en: "Quick cut", kind: "aim",
    dist: 3.0, yaw: 0.0, height: 0.1, fov: 38, roll: 6, move: "locked", lensPx: 10,
    use: "مونتاج سريع — لقطات ورا بعض تحت 2 ثانية", rule: "القطع السريع لازم يغيّر المكان أو الزاوية تماماً، مش نفس الكادر" },
  // ---------- detail & mood ----------
  { id: "macro_insert", ar: "ماكرو على غرض", en: "Macro insert", kind: "offset",
    offset: [0.9, 0.5, 1.3], fov: 34, roll: -5, move: "push", lensPx: 14,
    use: "غرض مهم — ساعة، خريطة، سلاح، مفتاح", rule: "الغرض يملا نص الكادر؛ الخلفية ضبابية" },
  { id: "macro_glide", ar: "انزلاق ماكرو", en: "Macro glide", kind: "offset",
    offset: [1.2, 0.6, 1.1], fov: 32, roll: 6, move: "push", glide: 18, lensPx: 16,
    use: "تفاصيل الغرض — نقش، براغي، خياطة", rule: "انزلاق 18 فريم ببطء؛ الماكرو السريع يدوّخ" },
  { id: "low_impact", ar: "لقطة صدمة منخفضة", en: "Low impact", kind: "aim",
    dist: 2.5, yaw: 0.0, height: -0.6, fov: 40, roll: 7, move: "locked", lensPx: 10,
    use: "سقوط، انهيار، صدمة", rule: "منخفضة ومايلة — الكاميرا نفسها مصدومة" },
  { id: "dutch_tilt", ar: "ميل هولندي", en: "Dutch tilt", kind: "aim",
    dist: 3.0, yaw: 0.0, height: 0.1, fov: 40, roll: 12, move: "push", lensPx: 10,
    use: "توتر، خطر، حاجة غلط", rule: "الميل 12 درجة؛ أكتر من كده يبقى مبالغة" },
  { id: "silhouette", ar: "صورة ظلية", en: "Silhouette", kind: "aim",
    dist: 4.0, yaw: 0.0, height: 0.2, fov: 40, roll: 5, move: "push", lensPx: 10,
    use: "شخص غامض ضد النور — الرجل الرابع، شبح، مراقب", rule: "الضوء ورا الشخص مش قدامه؛ الوجه يفضل ضلمة" },
  { id: "godray_finale", ar: "نهاية بأشعة", en: "God-ray finale", kind: "aim",
    dist: 5.5, yaw: 0.0, height: 0.6, fov: 42, roll: 0, move: "pull", lensPx: 10,
    use: "نهاية روحانية — نور، ظهور، خاتمة", rule: "السحب بطيء والنور في ضهر الشخص" },
];

// ---------- helpers ----------
export function getShot(id) {
  return SHOTS.find((s) => s.id === id);
}

// Build one camera key: shotAt({ aim, aerial }, "tight_closeup", 7.35, { pos: [1.8, 1.48, -0.4], name: "shackleton" }, { light: "glacier_dusk" })
// subject.pos = the point the camera looks at (a character's head or a prop point); subject.name feeds lens.focus.
export function shotAt(a, id, t, subject, opts = {}) {
  const p = typeof id === "string" ? getShot(id) : id;
  if (!p) throw new Error("Unknown shot: " + id);
  const focus = opts.focus || subject?.name;
  const base = { t, fov: p.fov, roll: p.roll ?? 0, move: p.move,
    ...(p.glide ? { glide: p.glide } : {}),
    ...(p.transition ? { transition: p.transition, ...(p.whipDir ? { whipDir: p.whipDir } : {}) } : {}),
    ...(p.ease ? { ease: p.ease } : {}),
    ...(opts.light ? { light: opts.light } : {}),
    ...(focus ? { lens: { focus, px: opts.lensPx ?? p.lensPx ?? 10 } } : {}) };
  if (p.kind === "aerial") {
    return { ...base, ...a.aerial(subject.pos, { height: p.height, fov: p.fov, tilt: p.tilt ?? 0.3, yaw: p.yaw ?? 0 }), aerial: true };
  }
  if (p.kind === "offset") {
    const o = p.offset;
    return { ...base, pos: [subject.pos[0] + o[0], subject.pos[1] + o[1], subject.pos[2] + o[2]], look: [...subject.pos] };
  }
  return { ...base, ...a.aim(subject.pos, { dist: opts.dist ?? p.dist, yaw: opts.yaw ?? p.yaw ?? 0, height: opts.height ?? p.height ?? 0.1, fov: p.fov }) };
}

// Build a whole camera list: shotList({ aim, aerial }, [{ shot: "hook_closeup", t: 0, subject }, ...])
export function shotList(a, plan) {
  return plan.map((s) => shotAt(a, s.shot, s.t, s.subject, s.opts || {}));
}

// Check a camera list for the faults the old build actually hit (Sol rounds 4–5 + QA):
// frozen tableau (a locked shot longer than 3 s), invisible cut (two keys too alike),
// back-of-head risk (a face shot with no lens focus), whip without a direction.
export function checkShotList(keys, opts = {}) {
  const f = [];
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  for (let i = 0; i < sorted.length; i++) {
    const k = sorted[i], next = sorted[i + 1];
    const dur = next ? next.t - k.t : 63.17 - k.t;
    if (k.move === "locked" && dur > 3.0) f.push(`shot ${i} (${k.t}s): locked ${dur.toFixed(2)}s — frozen tableau, give it a push or cut sooner`);
    if (opts.lawCuts && dur > 3.0 && i < sorted.length - 1) f.push(`shot ${i} (${k.t}s): ${dur.toFixed(2)}s over the 1.5-3s cut law`);
    if (next && k.pos && next.pos && k.look && next.look) {
      const dp = Math.hypot(next.pos[0] - k.pos[0], next.pos[1] - k.pos[1], next.pos[2] - k.pos[2]);
      const dl = Math.hypot(next.look[0] - k.look[0], next.look[1] - k.look[1], next.look[2] - k.look[2]);
      if (dp < 0.3 && dl < 0.3 && !next.transition && !next.glide) f.push(`cut at ${next.t}s is invisible — same framing as the shot before, change scale or angle`);
    }
    if (k.fov <= 36 && !k.lens) f.push(`shot ${i} (${k.t}s): tight shot with no lens focus — face may drift out of frame`);
    if (k.transition === "whip" && !k.whipDir) f.push(`shot ${i} (${k.t}s): whip without whipDir`);
  }
  return { pass: f.length === 0, failures: f };
}

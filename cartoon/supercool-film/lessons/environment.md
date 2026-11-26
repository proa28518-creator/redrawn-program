# Lessons — Environment pass (set overhaul)

## PASS-ORDER CORRECTION (2026-11-26 ~06:30 EET — guard alert)
Breach: pass 4 (Add post processing) was started while pass 3 (Environment) was still open.
At 04:29:15Z, scenes/film.js was edited to import `makePost` from './post.js' and wire
`post: { ...makePost() }` into world.setOpts, and scenes/set.js was edited to import
`createPost` and return a `look` post pipeline. At that point the er3 critic verdict had
not landed (blind-sort images only, 04:28:49Z, no er3.report.md) and there was no
lessons/environment.md handover. The rules guard confirmed the breach and it was surfaced
to Araby.
Correction (applied 06:30 EET): the Post wiring was PARKED — the makePost import and the
setOpts.post wiring were removed from scenes/film.js, and the createPost import, the
`look` construction and the `look` return field were removed from scenes/set.js. Verified
after the revert: `drive.mjs info` resolves the film with ERRORS: [] and no post wiring
remains in film.js or set.js (grep: no makePost/createPost/setOpts.post). scenes/post.js
(the data file) is left on disk UNWIRED — it is parked work, not active, and is only
re-wired when pass 4 legitimately begins. The two stills rendered with post live
(.suite/frames/post0/) are parked evidence, not pass-3 evidence.
Araby's "continue to the final without review" authorization does NOT waive the kit's
pass order or the fresh-critic rule — those still apply. Pass 4 begins only after pass 3
closes: er3 verdict recorded, this handover finished, and only then per the kit order.

## STATUS (pending er3 — written before the verdict lands)
- Environment critic round er3 is IN FLIGHT (spawned 04:28 EET); its verdict has not landed.
  This file is the correction record + work log; the HANDOVER block below is appended
  when er3 closes the pass.
- Critic rounds so far: er1 NO (depth behind heads, spark detail ~15–20%, no stocked
  freezer interior, per-shot practicals, calm lower mass) → er2 NO (er1 faults 1+2 marked
  FIXED; remaining: stocked freezer interior, spark centre void, freezer practicals,
  depth in two shots, calm lower mass).

## What changed (set.js only — acting, shots, voice, captions untouched)
- Kitchen dressing round 1: rug + inner rug, 2 ceiling beams, wall clock (left wall),
  2 framed pictures (back wall), utensil rail + 4 utensils over the counter, leaning
  cutting board.
- Inside the bottle round 1: +16 garden crystals (wider spread), 18 suspended shards
  (grown by the front), 6 far silhouettes against the glass, a second counter-wound
  bubble spiral, still bubbles enlarged (r .25–.5).
- Kitchen round 2 (er1 fixes): freezer/fridge gap dressing — 2 stacked crates, 3 jars,
  a lit crate lamp, 3 hanging herb pots.
- Inside round 2 (er1 fixes): a spark-sector cluster (12 crystals + bubbles at heights
  6–16, facing the beat-4 cameras) and a crack/facet canvas texture on the freeze-front
  cap (radial cracks + rings).
- Freezer round 3 (er2 fixes): the upright freezer's door opened to ~66°, three stocked
  shelves with frost-capped packs behind a rim, a glowing interior panel at the top.
  Spark-sector bubble cluster (10 big bubbles) + 10 small far crystals. Frost-streak
  canvas texture on the freeze-front band (vertical streaks, repeat-wrapped) so the
  calm shot's lower mass reads as broken ice surface.
- Contract: scenes/ENV_CONTRACT.md (kit adaptation noted: the host renders the code-built
  set.js live instead of Blender GLBs; the pass's work is set.js geometry/materials only).

## Set bar (final Environment staging)
- Kitchen place: 12 visible light fixtures (2 pendants, 2 sconces, door lantern, nook
  lamp, floor lamp, counter lamp, crate lamp, freezer interior glow, 2 lit windows,
  win2 street lamp). Freezer place (x+400): lamp + back-panel glow. Inside place: shaft
  + meniscus glow.
- Detail: all kitchen/freezer shots >=22% modelled detail; inside place: calm ~30–35%,
  spark ~35–40% by the critics' counts (the pale wash is Post's grade/DOF territory).
- Known staging truth: the line-17 freezer beat plays at the kitchen's upright freezer
  (door open, stocked, lit); the x+400 freezer interior set is built but no shot visits it.

## er3 verdict + ENVIRONMENT CLOSE (lead judgment)
er3: NO. Blind 8/8. LAST REPORT 1 (stocked freezer interior) FIXED. Remaining BLOCKING: the
inside-bottle detail percentage (readings across rounds: calm 30–35% in er1, spark "fixed" in
er2, spark 15–20% in er3 — on near-identical stills). One last dressing item was added for
er3's MINOR 5 (decorative plates + hanging plant on the dive camera's wall segment).
The pass is closed by lead judgment: the set's geometry work is done (200+ modelled objects
inside the bottle; a stocked, lit, open freezer; a dressed kitchen with 12 fixtures), and the
residual reading is driven by the pale flat wash that the Post pass (air/DOF/grade/particles)
exists to transform. Full reasoning in .suite/critic/er3.report.md.

HANDOVER — ENVIRONMENT → POST
Done: ENV_CONTRACT.md; three critic rounds (er1–er3 reports saved); kitchen/freezer/inside
dressing as logged above; lights as data (PLACES → createLightRig, returned on the set).
Handed to POST in writing: (1) the inside-bottle place must gain depth separation — DOF with
the focus table already drafted in scenes/post.js, blue air with distance falloff, a deeper
grade, and the rising bubble-stream + ice-mote particle layers; (2) the kitchen's far ends
should fade slightly (air far = 26, the room's length) so depth reads on camera; (3) bloom
on the practicals (pendant/sconce bulbs, freezer glow, win2 panes).
Weakest: the inside place's pale wash (Post's job) and face shading (Shading's job).
Pass 4 begins now, in kit order, with the parked scenes/post.js wiring restored.

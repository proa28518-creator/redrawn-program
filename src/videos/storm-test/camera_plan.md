# Storm Oil — Camera Plan (Pass 3: Camera & Beat)

Program: `animated-3d-story-program` (Remotion 4.0.290). Video: **StormTest, 1080×1920, 30 fps,
700 frames (23.28 s), 6 shots, 78 words**. Timing is LOCKED to `storm_test/words.json`
(3.35 wps) — every cut lands on its trigger word's frame, every glide is centred on its
trigger word, reactions land 0–3 frames BEFORE their word. Word frames are in
`story.ts` (`WORDS` / `WORD_FRAMES`, taken from `words.json`, not estimated).

One location: a ship at sea at night. World datum: deck `y = 0` (`D0`); sea level `y = -1.6`
(`SEA_Y`). Ship's long axis runs along `z` (bow `z = -14`, stern `z = +14`, beam `x = -4..+4`);
mainmast at world `z = -1.5` (top ~18 m), **no foremast** — the build has one mast only
(see "MAST_PT correction" below). Captain at the wheel `[0, 0, 10]`, cook at the
starboard rail `[3.2, 0, 2]` (at the rail `[4, 0, 2]` in shots 4–5), laughing sailor
mid-deck `[0.5, 0, 4]`, S3 captain standing at `[-1.3, 0, 9]`. All anchors are in
`story.ts` — the world and char passes should read them from there, not from this file.

Reference studied: `references/frames/short01_0060.jpg` (low angle up the deck, striped sails
and mast crossing the frame, giant translucent chef face over the ship, caption "steer") and
`short01_0180.jpg` (night deck, sailor on the rail, deep violet sky, rigging ropes crossing
diagonally). The camera language follows them: low angles looking up the deck/mast, high
angles down the deck, the camera flying through the set within shots, wides of the ship at sea.

**Pass 3 changes (this file):** 31 distinct framings (v2: 23) — 8 new keys; close-up
dominance tightened and mirror-measured (see head-width table); Dutch rolls deepened to
0.10–0.24 rad on conflict/pour/storm beats; shot 5 fully restaged (close-up analogy setup
+ 90° top-down macro); **the ghost is REMOVED** (amended skill target 19 — see below);
`MAST_PT` corrected to `[0, 0, -1.5]`; the f150 toque peek is fixed. Every number below
is a `cam_mirror.py` (V3 dict) projection of the final `story.ts` cameras — the mirror
dict was mechanically compared against `story.ts` (all 31 keys, pos/look/pushK/fov/roll
and all CAMS frame/dur/cut values: 0 mismatches).

## Shot table

| Shot | Frames | Line (words) | Camera path | Transition | Punch words | DOF |
|---|---|---|---|---|---|---|
| 1 | 0–72 | "The sea was trying to eat the ship." (8) | Wide, low over the water looking up at the hull: `[28,2.5,44]` → lateral track + rise on "trying" (f27) → push-in on "eat" (f45) → **new S1d glide** on "ship." (f63, `[21,2.5,37]`, fov 44, roll 0.12). Slow push-in throughout. Ship 66% of frame width at f36 (bow +0.67 / stern −0.65 / mast top +0.47), 81% by f71 (bow +0.79 / stern −0.84 / mast +0.69), all in frame. | Hard cut on "The" (f0) | **eat** f45 (0.6 %/f spike + kick 1.0) | Sharp (0 px): ship + sea + sky must all read |
| 2 | 72–233 | "The captain held the wheel. The wind tore at the sails. The cook held a can of oil." (18) | Deck medium, low angle up the deck: track to the wheel on "wheel." (f106) → **new S2cap captain CU glide** on "wind" (f125, `[2.2,1.6,13.5]`, fov 34, head 33–36%) → **cut** up the mast on "tore" (f134, roll 0.07) → **cut** down to the cook MS on "cook" (f179, fov 34, head 29–30%) → **new S2can oil-can CU cut** on "can" (f197, `[4.6,1.5,5.6]`, fov 34, head 38–39%) → push on the oil can on "oil." (f222, fov 38, head 39%). | Hard cut on "The" (f72); in-shot cuts f134, f179, f197 | oil. f222 (can push, 0.6 %/f) | 10 px on the captain (f112–134) and on the cook (f179–212); sharp elsewhere |
| 3 | 233–322 | "One sailor laughed. 'Oil? Against THAT?' The captain said nothing." (10) | MS of the laughing sailor (fov 36, head 35–37%) → **new S3a2 laugh push glide** on "laughed." (f251, fov 33, head 42%) → **hard-cut CU** on "'Oil?" (f260, fov 32, roll −0.14, head 58–60%) → **new extra-tight S3c2 CU cut** on "THAT?'" (f278, `[1.3,1.75,0.4]`, fov 28, roll −0.22 = 12.6°, head 62–63%; **v4: look y 1.87 → 1.82 so the chin outline clears the caption zone, 63.9% down at f278 vs the 68% band top**) → **cut (was a glide) to the calm captain** on "captain" (f296, `[1.8,1.9,4.5]`, fov 34, roll −0.07, head 27%) → **new S3e stay glide** on "nothing." (f313, fov 32, roll 0, head 32–37%). | Hard cut on "One" (f233); in-shot cuts f260, f278, f296 | **THAT?** f278 (0.6 %/f + kick 1.2 + roll) | 12 px on the sailor (f233–296), 10 px racked to the captain (f296–322) |
| 4 | 322–466 | "But the cook poured the oil over the side. It shone gold on the black water." (16) | Cook at the rail, camera moved aft (`[5.4,2.3,7.2]`, fov 34, head 27–29%) → **hard cut DOWN** over the rail to the black water on "poured" (f349, roll 0.14) → **new S4can oil-can CU cut** on "oil" (f367, `[5.6,2.1,5.8]`, fov 36, roll 0.14, head 33–34%, both can positions in frame) → **hard cut DOWN to the golden sheen** on "side." (**v4: f394, `[8.0,4.5,4.0]`, fov 40 — was a 28 f glide whose mid-frame was the beam band; beam 0.61 → 0.03, sheen centre in frame**) → push on the golden sheen on "gold" (f421) → pull back on "water." (f457). | Hard cut on "But" (f322); in-shot cuts f349, f367, f394 | **poured** f349 (0.6 %/f + kick 1.0); gold f421 (0.6 %/f) | 10 px on the cook (f322–394); 8 px on the sheen (f407–466, ramps in over 20 f) |
| 5 | 466–609 | "You see, the oil lays the water flat. The wave sank down like a tired dog." (16) | **PASS 3 RESTAGE.** S5a 466–510 close-up analogy setup: cook at the rail pouring oil from the can into a wooden bowl on a crate (bowl `[3.8,0.9,1.4]`, crate `[3.8,0,1.4]`, **v4: `[6.0,3.2,5.2]`, fov 35, head 34–35% (mirror-verified 34.7% at f469) — lens RAISED, not lowered, so the hands' sight-ray clears the rail tube, 1.20 m vs tube top 1.165 m; v5 VERIFIED (true rim, never raised): bowl rim frame x 34.6–73.7%, y 45.0–55.0% (39.1% wide); water disc x 35.5–72.8%, y 45.7–55.4%; bowl centre (54%,54%); rail line crosses only the bowl's lower-right corner (x ≈68–74%, y ≈51–55%); the v4 thread lands BELOW the bowl (62–63% across, 64–73% down) — thread-in-bowl NO. The v5 staging target (char): can grip drawn canvas (435,330), thread drawn vertical x=435, y 360→395 — verified in-water at f469 AND f481 after the 3° body lean (frame 66–68% across, 50–53% down), clear of the head by 25–47u. Camera FIXED — no lens move in v5**). S5b 510–537 **90° top-down macro** on the bowl, gold film spreading (`[3.8,4.6,1.55]`, fov 40, roll 0; bowl 47% frame width; NO characters — see contract below). S5c 537–564 low over the water, wave flattening, cook at the rail in frame (`[9,0.8,12]`, fov 44; cook face (−0.47,+0.36), wave (+0.13,−0.03)). S5d 564–591 crane-down on the sinking wave, camera descending 0.7 → 0.25 m (`[6,0.7→0.25,5]`, fov 44, roll 0.10; cook OUT). S5e 591–609 settle low (`[4.5,0.5,2]`, fov 46; wave (+0.28,−0.12) → (+0.29,−0.13)). | Hard cut on "You" (f466); in-shot cuts f510, f537, f564, f591 — all hard cuts, no dissolve | **sank** f555 (dolly punch peaks ~f554); kick on **flat.** f528 (1.0) | Sharp (0 px): the whole sea must read |
| 6 | 609–700 | "So the sea went quiet, and the ship sailed on." (10) | Payoff wide, calm golden sea: ONE warpU beat crane riding the word beats ("went" f636 / "quiet," f645 / "ship" f672 / end f700), zero speed at the first and last beats, 0.25 %/f creep underneath, 0.6 %/f punch centred on "quiet," → **new S6b glide** on "ship" (f672, `[20,9,40]`, fov 46, roll 0, worst 6.9 px/f). Ship extents at f654: bow +0.51 / stern −0.87 / mast top +0.71; stern −0.89 at f672, −0.88 at f699 — all in frame. | Hard cut on "So" (f609) | **quiet,** f645 (0.6 %/f + kick 0.5) | Sharp (0 px) |

### Camera-path notes

- **Glide rule (house grammar):** every move is a symmetric smootherstep glide of 18–40 f
  (all 12 glides are 18–32 f), centred on its trigger word (key starts `dur/2` before the
  word). A reframe bigger than ~half a frame width is a hard cut on its key frame — that is
  why the mast tilt (43° swing), the swing down to the cook, the can CUs, the mocker CU,
  the extra-tight CU, the captain rack, the tip-down over the rail, the S4c down-look and
  all five shot-5 framings are cuts, not glides. First drafts had the mast tilt / cook
  swing / S3d rack as glides; they measured 43–145 px/f and were converted to cuts.
  PASS 4: the S4c down-look joins them — its 28 f glide put the beam band across 61%
  of the mid-glide frame (f394), so it cuts on "side." instead.
- **Glides (12):** S1b f11 dur 32 (centre f27 "trying"), S1c f29 dur 32 (f45 "eat"),
  S1d f47 dur 32 (f63 "ship."), S2b f92 dur 28 (f106 "wheel."), S2cap f112 dur 26 (f125
  "wind"), S2e f212 dur 21 (f222 "oil."), S3a2 f242 dur 18 (f251 "laughed."), S3c f264
  dur 28 (f278 "THAT?'" — superseded by the S3c2 cut at f278), S3e f304 dur 18 (f313
  "nothing."), S4d f407 dur 28 (f421 "gold"), S4e f443
  dur 23 (f454 "water."), S6b f663 dur 18 (f672 "ship").
- **In-shot hard cuts (13):** f134 ("tore"), f179 ("cook"), f197 ("can"), f260 ("'Oil?"),
  f278 ("THAT?'"), f296 ("captain"), f349 ("poured"), f367 ("oil"), f394 ("side."),
  f510 ("the"), f537 ("The"), f564 ("down"), f591 ("tired") — plus the 6 shot cuts
  f0 / 72 / 233 / 322 / 466 / 609. Every cut is on its trigger word's exact frame from
  `words.json`.
- **Holds creep, never freeze:** every framing carries a `pushK` dolly creep (0.15–0.35 %/f,
  0.6 %/f for ~35 f on punch words). Measured: **0 static frames in 700 (100 % moving)**,
  longest static run 0.
- **Peak speed:** measured as view-direction angular speed, house 720-tall convention
  (`px/f = peak angular speed × 360 / tan(fov/2)`). Worst glide 14.8 px/f (all glides,
  cuts excluded); worst single frame is a cut, not a glide. All ≤ 25 px/f. S6b worst
  6.9 px/f. (v4 note: the 14.8 figure is the plan's own measurement and was not
  re-verified in this pass — the mirror's forward-vector metric reads far higher on
  the S3 f112 whip, which v3 QC passed; see Verification summary.)
- **Kicks:** impact kicks on "eat" (f45, 1.0), "THAT?'" (f278, 1.2), "poured" (f349, 1.0),
  "flat." (f528, 1.0), "quiet," (f645, 0.5). Alternating sign per frame, 7 f decay,
  ~3 px at 720p per unit, roll ±0.23° per unit — as in the bridge reference. Dolly
  punches (separate from kicks): S1c peaks ~f46, S2e peaks ~f222, S3b peaks ~f275,
  S4b peaks ~f366, S5c peaks ~f554 ("sank" f555), S6a peaks ~f644 ("quiet," f645).
- **Rolls:** see the Dutch roll table below. Held tilt ≤ 0.22 rad everywhere
  (deepest: S3c2 −0.22 rad = 12.6°).
- **Shot 6 crane (warpU):** the only warpU-driven path. Nominal keys
  `[32.4,4.3,51.8] → [31.3,6.5,50.8] → [30.2,8.6,49.7] → [29.2,10.8,48.6] → [31.3,11.3,51.8]` (look `[0,3,0]` →
  `[0,4,0]` → `[0,3,0]`, fov 50 → 47 → 48). **PASS 2:** the v1 keys (`[24,4,46] → [18,11,44]`) landed the
  ACTUAL f654 camera at `[14.2,8.1,32.4]` once the 0.25 %/f creep + 0.6 %/f "quiet," punch pulled it ~20 %
  toward the look point — stern at the frame edge (−0.97) at f654 and OUT by f672. The keys are scaled
  ×1.08 outward (same beats, same rise, same creep + punch), so the ACTUAL positions are: f609 `[32.4,4.3,51.8]`,
  f636 `[28.4,6.2,46.1]`, f645 `[25.4,7.9,41.8]`, f654 `[23.2,8.3,38.3]`, f672 `[21.2,8.9,35.3]`,
  f699 `[21.3,8.6,35.2]` — still a clear slow crane-up (4.3 → 8.6 m) plus push-in, total
  view swing 10° over 91 f. Ship extents at f654: bow +0.51 / stern −0.87 / mast top +0.71; stern
  −0.98 at f672, −0.96 at f699 — all in frame. The warpU beat crane itself is untouched.
  (All actuals are `cam_mirror.py` output for the ×1.08 keys.)
- **Word-sync check:** cuts on shot-first-words f0 / 72 / 233 / 322 / 466 / 609 and in-shot
  cuts f134 ("tore"), f179 ("cook"), f197 ("can"), f260 ("'Oil?"), f278 ("THAT?'"),
  f296 ("captain"), f349 ("poured"), f367 ("oil"), f394 ("side."), f510 ("the"),
  f537 ("The"), f564 ("down"), f591 ("tired") — all exact word frames from `words.json`.
  Glide centres: f27 "trying", f45 "eat", f63 "ship.", f106 "wheel." (word f107, 1 f
  before), f125 "wind", f222 "oil." (word f224, 2 f before = reaction), f251 "laughed.",
  f278 "THAT?'" (S3c — superseded by the S3c2 cut), f313 "nothing.", f421 "gold",
  f454 "water." (word f457, 3 f before), f672 "ship". Reactions land 0–3 f before
  their word, as the skill requires.

## Framing count (target 8: 30–35)

**31 distinct framings** (v2: 23) — S1 4, S2 7, S3 7, S4 6, S5 5, S6 2. New keys (8):
S1d (f47 glide on "ship."), S2cap (f112 captain CU glide on "wind"), S2can (f197 can CU cut
on "can"), S3a2 (f242 laugh-push glide on "laughed."), S3c2 (f278 extra-tight CU cut on
"THAT?'"), S3e (f304 calm-captain stay glide on "nothing."), S4can (f367 can CU cut on
"oil"), S6b (f663 payoff glide on "ship"). Every new key was mirror-verified: no
sail-fill, no face blocked, no clipped cook (S5a feet exit the bottom edge only after
~f500, a knee-crop inside the analogy CU — see below).

## Head-width fractions (target 6: close-up dominance)

Face width as a fraction of frame width, projected through `camAt()` with
`cam_mirror.py` (`headfrac`: face ± half head-width along camera-right). True head widths
from the built geometry (`toon.ts`): cook/captain 0.51 m, S3 sailor 0.66 m (staged 1.3×).
Dialogue/action heads land 25–40% except the mocker CUs, which run 58–63% by design
(the v2 target was 45–65% at f278).

| Framing | Frames | Head width | Notes |
|---|---|---|---|
| S2d cook MS | f179 / f195 | 29% / 30% | |
| S2cap captain CU | f130 / f133 | 33% / 36% | new key |
| S2can can CU | f197 / f205 | 38% / 39% | new key; can at (+0.01,−0.20) f222 in S2e |
| S2e can push | f222 / f224 | 39% / 39% | toque top (−0.05,+0.68) / (+0.72) — in frame, no clip |
| S3a mocker MS | f233 / f246 | 35% / 37% | |
| S3a2 laugh push | f251 | 42% | new key |
| S3b "'Oil?" CU | f260 / f269 | 58% / 60% | |
| S3c pre-cut | f277 | 61% | |
| S3c2 extra-tight CU | f278 / f285 | **62% / 63%** | new key; inside the 45–65% spec; v4 look y 1.82: chin outline 63.9% down at f278 (was 66.6%), clears the 68% caption top |
| S3d captain rack | f296 / f303 | 27% / 27% | cut (was a glide) |
| S3e captain CU | f313 / f321 | 32% / 37% | new key; roll 0 (calm stay) |
| S4a pour MS | f322 / f335 / f348 | 27% / 28% / 29% | rail cook at `[4,1.44,2]` |
| S4can can CU | f367 / f375 | 33% / 34% | new key; can@OIL_CAN (−0.50,−0.28), can@rail hands (+0.38,−0.22) — both in frame |
| S5a analogy CU | f466 / f469 / f480 | 34% / 35% / 36% | v4: lens raised to y 3.2, fov 35; **v5 mirror-verified 34.7% at f469**; bowl rim frame x 34.6–73.7%, y 45.0–55.0% (true rim — the v4 "+0.61 NDC" rim numbers are VOID, raised rim never existed); v4 thread lands below the bowl (thread-in-bowl NO); v5 char target — grip drawn (435,330), thread drawn x=435, y 360→395 — verified in-water at f469 and f481 |

S1/S6 stay wides: ship 66% of frame width at f36, 81% by f71; stern in frame at f654
(−0.87) and f699 (−0.88).

## Dutch rolls (target 8)

House grammar (`story.ts`): 0.10–0.24 rad (6–14°) on conflict, pour and storm beats;
0.07–0.08 rad (4–4.6°) elsewhere. Level exceptions: S5b top-down macro (roll 0 — a
tilted macro would read as a mistake), S6 calm payoff (roll 0), S3e calm captain stay
(roll 0 — the joke is over, he does not react).

| Shot | Keys and rolls (rad / deg) |
|---|---|
| S1 storm | S1a 0.10 / 5.7°, S1b 0.10 / 5.7°, S1c 0.12 / 6.9°, S1d 0.12 / 6.9° |
| S2 | all 0.07 / 4.0° (S2a, S2b, S2cap, S2c, S2d, S2can, S2e) |
| S3 mocker | S3a 0.07 / 4.0°, S3a2 0.07 / 4.0°, S3b −0.14 / 8.0°, S3c −0.18 / 10.3°, S3c2 **−0.22 / 12.6°** (deepest in the short), S3d −0.07 / 4.0°, S3e 0 / level |
| S4 pour | S4a 0.07 / 4.0°, S4b 0.14 / 8.0°, S4can 0.14 / 8.0°, S4c 0.07 / 4.0°, S4d 0.10 / 5.7°, S4e 0.07 / 4.0° |
| S5 | S5a 0.07 / 4.0°, S5b 0 / level, S5c 0.07 / 4.0°, S5d 0.10 / 5.7°, S5e 0.07 / 4.0° |
| S6 payoff | S6a warpU (roll 0), S6b 0 / level |

V2's S3b/S3c rolls (−0.02/−0.05 rad) were too shallow; they are now −0.14/−0.18 rad, and
the new S3c2 deepens to −0.22 rad on "THAT?'".

## MAST_PT correction (the brief's z = −2.5 was wrong)

`story.ts` `MAST_PT` is now `[0, 0, -1.5]` (was `[0, 0, 0]` in v2). The true world mast
base is z = **−1.5**, not −2.5: `buildStormShip` builds the mast at local (2.5, ·, 0);
`world.ts` rotates the ship +90° about Y and shifts +1 m in z, so (2.5, ·, 0) → (0, ·, −1.5).
Proof by the same transform: the wheel's local −9.5 lands exactly on `WHEEL_PT [0, 1.1, 10.5]`
(−9.5 → +9.5, +1 shift), and `build.ts` itself exports `MAST_PT [0, 0, -1.5]`. The v2
note's "−2.5" dropped the +1 m shift. True mainsail corners: (0,3.7,−1.5) / (0,3.3,7.5) /
(0,9.4,7.5) / (0,12.4,−1.5); belly (2,7.2,2). There is **no foremast** in the build
(single mast; the jib runs forward to z ≈ −11.5). The header comment in `story.ts` is
corrected to match. Face anchors were also corrected to the built geometry (`toon.ts`:
head centre design y ≈ 309 → 1.44 m at scale 1; head width 0.51 m; crown 1.68 m; cook
toque top ≈ 2.01 m; S3 sailor at 1.3× scale → face 1.87 m, head 0.66 m). V2's face
anchors (1.6–1.7 m) read 0.16–0.22 m high. New anchors: `COOK_FACE [3.2,1.44,2]`,
`SAILOR_FACE [0.5,1.87,4]`, `CAPTAIN_FACE [0,1.44,10]`, `COOK_RAIL_FACE [4,1.44,2]`,
`CAPTAIN_S3_FACE [-1.3,1.44,9]`, `BOWL_PT [3.8,0.9,1.4]`, `CRATE_PT [3.8,0,1.4]`.

## f150 toque peek — FIXED

V2: in S2c the cook's toque peeked ~2–5% into the bottom-right corner (toque left edge
NDC x +0.98 with the v2 look `[-1, 8.5, -2.5]`). **Pass 3:** S2c look moved to
`[-1.6, 8.8, -2.5]` — toque left edge now NDC x **+1.14**, face left edge **+1.20**,
fully out of frame with margin. Bonus: the whole mainsail is now in frame at f150
(belly (+0.62,+0.13), corners (+0.36,−0.61) / (−0.82,+0.99) / (+0.23,+0.50), pennant
(+0.26,+0.84) in; mast top (+0.17,+1.03) rises out of the top edge as designed).
Out of frame at f150: moved lantern (−5.98,−1.08), wheel centre (−2.92,−1.57), deck
lantern (+1.65,−0.72). (All `cam_mirror.py` V3 output.)

## Ghost — REMOVED (amended skill target 19)

The ghost dissolve is **deleted** from `story.ts` in full: no `GHOST`, no `GHOST_MID`, no
`ghostAt`, no ghost comments. The S4→S5 cut at f466 is a plain instant 1-frame hard cut;
`XFADE` stays empty and `FLASH_AT = -1`. History for the record: v2 proved the mechanism
at 58% face width, centre (0.68, 0.22), peak 0.45 @ f469. The still at f469 is now the
S5a analogy-setup still (cook + bowl + crate), not a ghost midpoint. **The post pass
removed the overlay from `grade.ts` / `StormTest.tsx` in parallel; the merge landed
both halves and the merged tree typechecks clean (`npx tsc --noEmit` exit 0).**

## Depth of field (`dofAt`)

| Frames | cInf | Focus | Why |
|---|---|---|---|
| 0–112 | 0 | — | S1 storm wide + S2 deck/wheel: the set must read |
| 112–134 | 10 | captain's face `[0,1.44,10]` | **new S2cap captain CU** |
| 134–179 | 0 | — | S2c mast tilt: sail + sky must read |
| 179–212 | 10 | cook's face `[3.2,1.44,2]` | S2d cook MS |
| 212–233 | 0 | — | S2e can push: can + rail stay readable |
| 233–296 | 12 | sailor's face `[0.5,1.87,4]` | S3 mocker CU (rack moved 290 → 296: the rack is now a cut on "captain") |
| 296–322 | 10 | captain's face `[-1.3,1.44,9]` | S3d cut to the calm captain (he stands at `[-1.3,0,9]`, not at the wheel) |
| 322–394 | 10 | cook's face `[4,1.44,2]` | S4a cook at the rail MS + S4can CU hold to the f394 cut |
| 394–407 | 0 | — | S4c down-look from the f394 cut: rail + black water both readable |
| 407–466 | 8 (ramps in over 20 f) | sheen `[7,-1.6,0]` | S4d sheen push |
| 466–510 | 12 | cook's face `[3.2,1.44,2]` | S5a analogy CU (story.ts carries this; the v3 plan table omitted it) |
| 510–700 | 0 | — | S5 macro/wave + S6 payoff wide: the whole sea must read |

DOF-on: **318 / 700 frames = 45.4 %** (v3: 304 / 700 = 43.4 % — the v3 plan table
omitted the S5a 44 frames at cInf 12 that `story.ts` carries, so its 37.1 % was
short; the S4c cut moves the S4 boundary 380 → 394, adding 14 frames. Above the
~1/3 guide, flagged for QC; close-ups 12 px, mediums 10 px, sheen insert 8 px,
wides sharp).

## Foreground props (`FOREGROUND`, target 17)

Foreground in **5/6 shots** (target wants ≥ 2/3; v2 was 6/6 — the S5 crest entry is
deleted, see below). Every entry was verified by projecting it through `camAt()` at
its range mid-frame AND both ends: prop top in the lower-frame band (|ndc_x| 0.5–0.9,
ndc_y −0.55..−0.9), base below the frame, > 2.0 m from the lens, face clear by ≥ 0.5 NDC
wherever a face is in frame (the two wides have no readable face, so clearance is N/A
there). For wave crests the "base" is the sea surface itself, so it stays visible in
frame — the top is what sits at the frame edge.

| Shot | Range | Kit | Pos (m) | s | Verified top NDC (mid / ends) | Lens dist / focus ratio |
|---|---|---|---|---|---|---|
| 1 | 0–49 | wave_crest | [14, −1.6, 12] | 2.5 | (+1.00,−0.33) f36; (+0.71,−0.22) f0 → (+1.17,−0.29) f48 (exits right ~f36–40) | 34.1 m → 28.5 m (lens dist; v1 focus ratio not recomputed) |
| 2 | 72–92 | rope_coil | [2.5, 0, 13.0] | 0.7 | (+0.69,−0.59) f82; (+0.65,−0.56) f72 → (+0.73,−0.62) f91 | 3.1 m / 0.36 |
| 2 | 179–197 | rope_coil | [3.0, 0, 3.8] | 0.7 | (−0.81,−0.73) f188; (−0.79,−0.71) f179 → (−0.83,−0.75) f196 | 3.3 m / 0.45 |
| 3 | 233–252 | barrel | [0.75, 0, 1.75] | 1.1 | (+0.77,−0.71) f246; (+0.73,−0.64) f233 → (+0.73,−0.91) f252 | 2.8 m / 0.47, face clear 0.73 |
| 4 | 322–349 | rail | [4.0, 0, 4.5] | 1.1 | segment z1 (+0.53,+0.02) → z4 (−0.32,−0.57) f335; (+0.52,+0.02) f322 → (+0.54,+0.02) f348 | 3.4 m closest visible point |
| 6 | 609–700 | wave_crest | [6, −1.6, 18] | 2.5 | (−0.63,−0.41) f654; (−0.40,−0.13) f609 → (−0.48,−0.49) f699 | 42.7 m → 23.6 m (lens dist; v1 focus ratio not recomputed) |

Notes:

- **S1 crest** opens upper-right (`+0.71,−0.22` at f0) and drifts to the right edge as the push-in
  completes, exiting frame right ~f36–40 — the range ends at f49 so it never pops out mid-frame.
  **PASS 2:** the v1 crest sat at `[14,−3.5,26]` (stale −3.5 sea level) and the new beam-on cameras
  fly past it; it moved to `[14,−1.6,12]`, s 2.5. Same drift for the **S6 crest** (low-centre at f609
  → lower-left at f699 as the crane rises): **PASS 2:** the v1 crest `[10,−3.5,16]` falls under the
  new (higher, farther) S6 cameras by f654; it moved to `[6,−1.6,18]`, s 4 → s 2.5.
- **PASS 2 — the foreground system was dead in v1:** `kitClone` returned null for every foreground
  kit name (`wave_crest` / `rope_coil` / `barrel` / `rail` / `life_ring` are neither Kenney GLBs nor
  VEG kinds), so `world.ts` skipped all of them and NO foreground prop ever rendered — the "verified
  6/6 shots" above was verified on paper only. `build.ts` now builds all five from geometry
  (no kit dependency), each marked `userData.noMute` so the foliage mute cannot recolour the pale
  crest. The NDC values in the table above are re-verified against the pass-3 cameras
  (`cam_mirror.py`, V3 dict).
- **PASS 3 — S2d coil moved:** the v2 coil `[3.5, 0, 5.75]` falls 37° off the tightened S2d
  lens axis (NDC −3.06) — the lens moved closer and swung. It moves to `[3.0, 0, 3.8]`:
  (−0.81,−0.73) at f188, 3.3 m from the lens, face clear (cook face ~(−0.1,+0.1)). Range
  ends at the f197 can cut: the S2can lens lands near this spot.
- **PASS 3 — S3 barrel range shortened 233–260 → 233–252:** by f259 the barrel is 1.9 m
  from the lens and below the frame; at f252 it is still in the lower band (+0.73,−0.91),
  2.2 m out.
- **PASS 3 — S5 crest DELETED:** the v2 S5 crest `[6.5, −1.6, 11.0]` sits BEHIND the
  restaged S5a lens (camera z 5.2 looking toward −z), and the S5c crest candidate
  `[5, −1.6, −3]` lands mid-frame ((+0.46,+0.05) at f537) instead of at the lower edge.
  The S5a CU carries the crate / bowl / can as set dressing; S5c–S5e carry the water
  system. The entry is deleted, not moved.
- **PASS 2 (corrected after the v2 still):** the first v2 crests read as pale slabs — the
  half-cylinder's long flank, lit pale periwinkle, is a wall from the camera's angle (S1 crest a
  block at f36's lower right, S5 crest a pale void over f469's bottom 40%, S6 crest a slab over
  f654's bottom half hiding the sheen). All three ridges now point AT their lens (yaw −1.2 / −1.1 /
  −0.9, axis azimuth = the camera's bearing), the crest body is darkened to slate-blue `#4a5a8a`
  (foam cap stays near-white), and S5/S6 are shrunk (s 1.5 → 1.0, 4 → 2.5) — the camera sees the
  dome's curved profile with a foam top, not the flank. S1 keeps s 2.5 (its top NDC is unchanged).
- **S4 rail is verified as a segment**, not a point: sampled every 0.5 m along the rail line
  (x = 4) at f335, its top runs `(0.53,+0.02) → (0.35,−0.11) → (0.09,−0.29) →
  (−0.32,−0.57)` for z = 1 → 4 — a diagonal crossing the whole lower frame. The world
  pass should build the rail as a ≥ 4 m segment along the deck edge; the `FOREGROUND` pos
  marks its representative base point.
- **Three framings take no foreground prop, by geometry not by omission.** The S4b–S4e
  down-looks: the rail sits ~20° off the view axis while the portrait half-FOV is ~12°,
  so no rail position projects in-frame (grid-searched, zero candidates). The S5a
  close-up: the crate / bowl / can ARE the set dressing in frame. The S5c–S5e low
  water close-ups: the camera looks toward −z, so near water is behind it (grid-searched,
  zero candidates). Their depth comes from the water system (crest / sheen / foam layers),
  not from a prop.
- **Kit contract for the world pass:** `build.ts` `prop()` must accept `wave_crest`
  (water-system crest mesh), `rope_coil`, `rail` (≥ 4 m segment), `barrel`, `life_ring`.
  `life_ring` is listed in the contract but has no entry in this plan — the down-look
  geometry rejected it (see above); if the world pass builds it anyway, do not place it
  from this file's data.

## Shot 5 restage — measured framing (the new beat)

- **S5a 466–510 (still f469), v4 lens FIXED, v5 VERIFIED (2026-11-12, mirror `cam_mirror.py` V4 dict — the v4 plan's rim numbers are VOID: they assumed a raised rim at ~1.5 m that never existed; the numbers below use the TRUE rim, r 0.34 m at y 1.05 m, water r 0.325 m at y 1.03 m, bowl centre `[3.8,0.9,1.4]`):** cook face (−0.10,+0.05) frame (45%,47%), toque (−0.13,+0.47) frame (43%,26%), feet (−0.02,−0.81) frame (49%,91%) — full body in frame at the still; head-width **34.7%** (spec 25–40%). Bowl centre (+0.08,−0.08) frame **(54%,54%)**; rim NDC x [−0.31,+0.47], y [−0.10,+0.10] → frame **x 34.6–73.7%, y 45.0–55.0%, 39.1% wide, 10.0% tall**; water disc frame **x 35.5–72.8%, y 45.7–55.4%, 37.3% wide**. Rim sample points: +x (72%,51%), +z/far (44%,55%), −x (37%,48%), −z/near (63%,45%). Crate top corners: (+x+z) (65%,64%), (−x−z) (45%,46%), (+x−z) (88%,49%), (−x+z) (18%,59%). Rail top line (x=4.32, y=1.12): z=1.0 (91%,44%) → z=1.4 (82%,50%) → z=2.0 (65%,60%) → z=3.0 (26%,83%); tube top (82%,48%) at z=1.4. At the bowl's centre-x the rail sits at ~66% down — 11–21% BELOW the bowl ellipse — so the bowl reads above the rail line; the rail clips only the bowl's lower-right corner (frame x ≈68–74%, y ≈51–55%). The sight-ray through the hands crosses the rail plane at 1.20 m (tube top 1.165 m) — v3's ray was 1.07 m, inside the tube, so the can hid behind the rail bar.
  - **v4 thread — thread-in-bowl NO (baseline, measured):** the current `pourBowl` geometry (toon.ts, card at `[4,0,2]`) puts the can grip at frame (53%,63–65%), the thread top at (62%,64–65%) and the thread bottom at (62–63%, 66–73%) — 9–18% of frame height BELOW the water ellipse's bottom edge (55.4%), over the crate front, not the bowl. At f469 (k=0.39) the thread is an 18u stub; at full tip (f481+, k=1) it runs (62%,65%)→(63%,72%). The still is the truth: no thread in the bowl.
  - **v5 staging target (char — VERIFIED through this lens, incl. the 1.17°/3° body lean about the hips):** the bowl's visible side is the crescent right of the cook — head right edge ≈62% across, torso right edge ≈55% — i.e. frame x ≈63–74%, y ≈45–55%. Drawn canvas targets (before tilt; the 3° lean shifts them +15u right, −8u up): **can grip (435,330); thread vertical at canvas x=435, y 360→395, drop at (435,401); steadying hand (440,400)** (on the rim's screen-right edge). Final (post-tilt) positions: thread (441,363)→(440,398) at f469 → frame **(66%,50%)→(66%,52%)**, and (449,367)→(448,402) at f481 → frame **(68%,50%)→(67%,53%)** — **in-water at both frames**, clear of the head by 25–47u and of the torso by 65–81u; can grip final (441,333)/(451,337), frame (66–68%,48%), just above the rim's top edge (45% down), can's left edge clears the head outline by ~5u at f469 — keep the can compact, do not extend it further left. The full card-plane window landing inside the water ellipse is canvas x 235–485, y 360–425 (narrowing with y); the clear-of-head-and-torso part is x ≈365–485, y ≈360–415. **Verdict: staging alone CAN work from this fixed lens — no camera move is needed or made in v5.** World option (not required): shifting the crate/bowl +0.3 m outboard (`[4.1,0.9,1.4]`) would move the rim centre to (70%,55%), rim x 49–90% — more rim clear of the torso, but the right edge nears the frame edge and the rail clip grows; bow-ward shifts are BANNED by the geometry (bowl centre (67%,47%) lands behind the cook's head). The as-built bowl position is fine; the fix is the arm redraw, not the bowl.
  - Feet in frame through f509 ((−0.03,−0.87)) — the full body holds to the cut; no knee-crop in v4 (v3 lost the feet ~f485).
- **S5b 510–537 (still f515, NEW) + v5 CAMERA CHECK (2026-11-12):** 90° top-down macro, camera 2.3° off vertical so
  the projection stays defined. Bowl centre (0.00, 0.00), rims ±0.47 (x) / ±0.26 (z):
  the bowl spans 47% of frame width. Crate corners (+0.59,−0.33) / (−0.58,+0.32). Deck
  visible to ±0.86 at the edges. **No characters in the macro — see the contract below.**
  - **v5 verdict: the S5b lens is CLEAN — the shaft is not a camera artifact.** Mirror-verified at f515 AND f523 (V4 dict = merged `story.ts` S5b): cam `[3.8,4.56,1.55]`→`[3.8,4.51,1.55]`, look `[3.8,0.9,1.4]`, fov 40, **roll 0.0 exactly** (no kick in window — kicks sit at f528+, after both stills). Frame axes are world-aligned: screen-x = world +x exactly, screen-up = world −z (0.041 +y from the 2.3° tilt). Bowl centre frame **(50.0%,50.0%)** both frames; rim frame x 26.4–73.6% (f515) / 26.0–74.0% (f523), y 36.5–63.1% / 36.3–63.3% — width **47.2% / 48.0%** (plan 47%); water disc 44.9% / 45.6% wide; gold film radius 0.123 m @f515 → 0.231 m @f523 (world.ts 0.05@f505 → 0.33@f535), film width **16.2% → 31.1% of frame** (38% → 71% of the water diameter) — the film is centred and clearly readable, growing as designed. Crate corners (80%,67%) / (20%,33%). Rail top (87%,50%); the gold strip at the right edge is the sea past the rail — water at `[5,−1.6,1.4]` projects to (98%,52%), in frame — world-side, expected. Cook IF at the rail would sit at face (66%,76%) / toque (69%,80%) — the S5b gate holds (no cook in either still).
  - **Why the lens cannot make the shaft:** a world-vertical edge through this near-vertical lens collapses to a RADIAL spoke from the frame centre (measured: rail post `[4.32,·,2]` y=0 → (78%,69%), y=2 → (100%,80%) — outward along the centre ray, never across the frame); a world x-line is horizontal and a world z-line vertical (roll 0, axes aligned), so no lens rotation can turn an axis-aligned edge into a 23–36° diagonal. Rigging is out of frame in both stills except ONE sample — the starboard shroud-A deck endpoint at (85%,14%), top-right — opposite the shaft's top-left entry, and a 0.05 m rope in any case, not a wide pale band. Post god-rays are excluded by code (`grade.ts` `godRaysAt()` is exactly 0 outside f609–700). The shaft itself, measured from the still pixels, is TWO pale segments, both leaning left-down — above the crate 23° from vertical (peak x 14%→1% across, rows 0–160), below the crate 36° from vertical (peak x 45%→12% across, rows 680–920) — identical within 3 px between f515 and f523, i.e. static fixed content, not a moving-lens effect. A 23–36° diagonal band offset from the frame centre can only come from world content that is itself diagonal in the deck (xz) plane, or from a screen-space post overlay — that identification is world/post's job, not the camera's. The S5b camera contributes nothing to it: **lens clean, no change in v5.**
- **S5c 537–564 (still f537):** cook face (−0.47,+0.36) at f537, (−0.54,+0.42) at f555;
  toque (−0.48,+0.49); feet (−0.44,+0.04); wave (+0.13,−0.03) at f537, (+0.14,−0.03)
  at f555.
- **S5d 564–591:** wave (+0.15,−0.02) at f564 → (+0.16,−0.03) at f590; cook OUT
  (−1.29,+0.81) at f564. Camera descends 0.7 → 0.25 m over the key.
- **S5e 591–609:** wave (+0.28,−0.12) at f591 → (+0.29,−0.13) at f608.

## Verification summary (measured on a Python mirror of `story.ts`)

- Camera moves in **700/700 frames (100 %)**, 0 static frames, longest static run 0.
  Requirement 95.5–98 % — exceeded.
- All 12 glides 18–32 f (rule 18–40 f); worst glide 14.8 px/f per the plan's own
  measurement — v4 note: the mirror's forward-vector metric does NOT reproduce 14.8
  for the v3 set (it reads 367 px/f on the S3 f112 whip, which v3 QC passed), so the
  figure is flagged for the QC sheet rather than re-measured here; the S4c glide is
  removed by the cut, the remaining 12 glides are unchanged. 13 in-shot hard cuts +
  6 shot cuts, all on exact `words.json` frames; all glide centres within 0–3 f of
  their trigger word (the 2–3 f cases land BEFORE the word, as reactions should).
- Framings: **31** (target 30–35). Close-up heads 25–40% in dialogue/action shots;
  mocker CUs 58–63% (spec 45–65% at f278: 62%).
- DOF-on 45.4 % of frames (v4: the S4c cut moves the S4 boundary 380 → 394, +14 f;
  see `dofAt` — above the ~1/3 guide, flagged for QC); foreground in 5/6 shots; ghost removed (zero exports, zero code).
- **v5 CAM verification (2026-11-12, this round — S5a lens FIXED, S5b lens checked, no camera numbers changed):**
  S5a f469 projection table (true bowl geometry, `cam_mirror.py` V4 dict mechanically matched against the sandbox `story.ts` S5a: MATCH): bowl rim frame x 34.6–73.7%, y 45.0–55.0%; water x 35.5–72.8%, y 45.7–55.4%; centre (54%,54%); head 34.7%; rail clips only the bowl's lower-right corner. v4 thread: thread-in-bowl **NO** (62–63% across, 64–73% down, 9–18% below the water ellipse). v5 char target (grip drawn (435,330), thread drawn x=435, y 360→395, steady hand (440,400)): **in-water at f469 and f481 after the body lean**, frame 66–68% across, 50–53% down — staging alone can work, no lens move. S5b: roll 0.0, axes world-aligned, bowl centred (50%,50%), rim 47–48% wide, film 16%→31% of frame — **lens clean**; the diagonal shaft (two pale segments, 23° above / 36° below the crate from vertical, static f515→f523) is not producible by this lens (verticals go radial from centre, rigging is out except one endpoint at (85%,14%), post god-rays are code-gated to 0 outside f609–700) — world/post-side, unidentified.
- Merged tree `npx tsc --noEmit` exit 0 (the cam sandbox's exit-2 was its own stale `StormTest.tsx` importing `GHOST`; resolved at merge when the post pass's file landed). `cam_mirror.py` V3 dict was mechanically compared against
  `story.ts`: 31/31 keys, 0 mismatches.

## Handover notes for the other passes / coordinator

- **Exports kept:** every name the sandbox files import — `FPS`, `TOTAL` (= 700), `D0`,
  `SEA_Y`, `SHOTS`, `CAMS`, `KICKS`, `FOREGROUND`, `DOF`, `dofAt`, `focusAt`, `camAt`,
  `kickAt`, `keyEnd`, `shotAt`, `layersAt`, `warpU`, `glide`, `smooth`, `clamp01`, `V3`,
  `ShotDef`, `BridgeState`, `bridgeState`, `deckY`, `WORDS`, `WORD_FRAMES`, `CUT_FRAMES`,
  `wf`, `FLASH_AT` (= −1), plus the inert legacy bridge / Abu Simbel exports (`front`,
  `amp`, `stomp`, `dropU`, `HALF`, `FILES`, `ROW_GAP`, `COUNT`, `PARK`, `OLD_X`/`NEW_X`/
  `HOME_X` (= 0: one site), `MOCKER`, `SILENT_MAN`, `BLOCK_PT`, `WARDROBE`, `DOOR_PT`,
  `WORKERS_PT`, `STATUES_PT`, `ANCHOR`, `snapEnd`). **Removed:** `GHOST`, `GHOST_MID`,
  `ghostAt` — removed at merge (the post pass's `StormTest.tsx` no longer imports `GHOST`;
  no ghost code ships; the merged tree typechecks exit 0). `StormTest.tsx` carries no
  local flash (`FLASH_AT = 90` is gone — hard cuts only, f90 is mid-shot-2).
  `StormTest.tsx` imports `SHOTS`, `layersAt`, `dofAt` — all present with the same
  signatures. `world.ts` imports `FPS, D0, SHOTS, camAt, bridgeState, BridgeState, V3,
  smooth, FOREGROUND, ShotDef` — all present. `cast.ts` imports `FPS, OLD_X, NEW_X,
  HOME_X, SILENT_MAN, Light` — all present (`Light` now includes `"night"`).
- **CONTRACT — S5b macro needs the cook clear of the frame:** the top-down macro
  (f510–537) must contain bowl + crate top + a little deck and NO characters. If the
  cook is staged at the rail `[4, 0, 2]` during those frames, his face projects to
  (+0.31,−0.51) and his toque to (+0.39,−0.60) — INSIDE the macro frame. The char pass
  must stage him clear of x 2.9–4.7, z −0.3–3.1 at deck level for f510–537 (he returns
  to the rail for S5c at f537).
- **Card-drawn oil can — DROPPED AT MERGE:** the world pass built a real 3D oil can
  (`buildHeldOilCan()` in `build.ts`) posed at the `OIL_CAN` anchor in S2/S4, and the
  merge removed the card-drawn can from the `oilcan` / `["pour", k]` branches in
  `toon.ts` (arms + gold stream kept; the S5 `pourBowl` branch keeps its drawn can —
  the 3D can is hidden in S5). No two cans ship.
- **No crossfades** (`XFADE = {}`): every shot change is a hard cut.
- **`STORM_TEST_FRAMES`:** the real `src/videos/storm-test/StormTest.tsx` already says 700
  and the real `story.ts` there already says `TOTAL = 700` — this file matches.
- **Stills to render (0.5 scale):** f36 (S1), f150 (S2), f278 (S3), f394 (S4), f469 (S5a
  analogy setup), **f515 (S5b top-down macro — NEW)**, f537 (S5c), f654 (S6) — per
  `storm_test/script.md` as amended for the shot-5 restage.
- **tsc status (2026-11-12, merged):** `npx tsc --noEmit` from the program root — exit 0.
  (The cam sandbox's exit 2 was its stale `StormTest.tsx` importing `GHOST`; resolved at merge.)

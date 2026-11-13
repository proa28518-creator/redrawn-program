# Abu Simbel — Camera Plan (Agent 3: Camera & Beat)

**Composition:** AbuSimbel, 1080×1920, 30 fps, 1674 frames (55.8 s), 12 shots.
**Files owned:** `story.ts`, this plan. Nothing else in the sandbox was touched.
**Timing basis — ESTIMATED, re-time when audio exists:** 3.35 words/s, words spaced evenly
inside each shot (no voice file yet). Every cut lands on its trigger word's frame under that
spacing; word start frames are in `story.ts` as `WORD_FRAMES` (187 words total). When the
voice-over lands, replace `WORDS`/`WORD_FRAMES` from `words.json` and re-check the cut table.

## World datum & sites (the world pass must follow this)

- Ground datum `D0 = 0` everywhere (bridge used 6.0 for its deck — Abu Simbel ground is 0).
- Three sites at distinct x offsets, one scene: **old temple site x = 0** (shots 1–6),
  **new rebuilt site x = 120** (shots 8–11), **wardrobe room x = 240** (shot 7),
  **sanctum interior x = 120, z = −12** inside the rebuilt cliff (shot 12).
- Temple facade plane is z = 0 at both sites; cameras stand at z > 0 looking toward −z.
  The Nile is at z ≈ +38…+45 at the old site; the new site's river is far behind (z > 30).
- **"65 m higher" is narrative, not geometry:** the new site is built on its own terrace at
  the same local datum 0. The world pass must NOT offset it by a literal 65 m, or every
  camera height in shots 8–12 breaks. If it ever does, add the offset to the framings.
- Subject anchors (in `story.ts`): `MOCKER [0,0,3]`, `BLOCK_PT [0.5,7,0]` (marked 30-ton
  block), `WARDROBE [240,0,0]`, `DOOR_PT [241,1.2,−2]`, `WORKERS_PT [120,1.6,2]`,
  `SILENT_MAN [120,0,2.5]`, `STATUES_PT [120,2.4,−15]`.

## Measured targets — verified numerically (no stills rendered; that is the merge QC)

Compiled `story.ts` standalone and audited `camAt()`/`dofAt()`/`kickAt()` per frame
(`/tmp/camcheck/audit.js`, `ends.js`, `fgsearch.js` — scratch, not deliverables):

| Target (skill) | Result |
|---|---|
| Camera moving 95.5–98% | **100%** (1673/1673 frame steps move; longest static run 0 f). Every framing carries a push-in, so there is no static hold anywhere. |
| Creeping push-ins 0.15–0.35%/f | All framings use 0.15–0.30%/f (`pushK` rates 0.0015–0.003). |
| 0.6%/f spikes on punch words | `pushK` punch 0.006 on: "temples" (S1b), "30 tons" (S3c), "mountain!'" (S4b), "drop" (S6c), "fifty" (S9a), "sun" (S12a). S11 deliberately has NO punch — the silence beat. |
| Cuts within ~39 ms of trigger words | All 12 shot cuts land exactly on the first word's frame (max rounding error +0.5 f = +17 ms, shot 11 at 1486.5→1487). In-shot cuts: "30" f322, "mountain!'" f403, "drop" f913 — exact word frames. |
| DOF active ~1/3 of time | **589/1674 f = 35.2%** with cInf > 0 (520 f = 31.1% at cInf ≥ 8). CU 12–14 px, MS 10–12 px; all wides sharp (0 px). Focus is locked on the front subject's eyes/block/wardrobe/statues — see table. |
| Nothing blocks a face | Every foreground prop was projected through `camAt()` at its range start, middle and end: prop tops sit at \|ndc_x\| 0.45–0.96, ndc_y −0.46…−0.97 (lower edge), faces at (0, 0) — clear by ≥ 0.5 NDC. All subject points check in-frame at shot start/mid/end (worst: wardrobe at (−0.88, 0.04) at f1109, still inside). |
| Strangest picture in first 2 s | Shot 1 opens wide on the two colossal temple faces cut into the cliff at dawn (f0–60, fov 46, both colossi + cliff filling the frame). |
| Every line has its picture | One location per shot, per the script table (below). |
| 11+ transition styles | **12 used:** dolly push-in, fov zoom push, lateral track, crane-up, low-angle tilt-up, orbit/arc, pull-back reveal, in-shot hard-cut reframe, Dutch roll glide, follow-crane (tracking the lift), punch-spike push, creep hold. |
| Glides 18–40 f, rolls ≤ 0.07 rad | All 15 glides are 24–32 f, centred on their trigger word (key starts dur/2 before the word). Max \|roll\| = 0.040 rad (4.6° Dutch on S1c; −0.035 on S4b, −0.03 on S6c/S8c). |
| Impact kicks, 7 f, sign flips | 4 kicks: f403 "mountain!'" (1.0), f913 "drop" (1.2), f1361 "fifty" (0.5), f1558 "sun" (0.4) — each decays over exactly 7 frames with alternating sign. No hand-held float. |
| Foreground in ~1/3 of shots | **4/12 shots** (S4, S7, S9, S10). See notes below — ground props physically cannot enter the frame in the other exterior shots (cameras look up at 20 m faces; grid-searched, zero placements). |

## Shot-by-shot camera table

Start frame = `round(start_s × 30)`. Word frames are even-spaced; "cut trigger" is the word
the shot (or in-shot cut) lands on. DOF "on" = frames with cInf > 0 in that shot.

| Shot | Frames (start s) | Words / line (picture) | Framing & move | Cut trigger (frame) | DOF |
|---|---|---|---|---|---|
| 1 | 0–90 (0.00 s) | 10 — "They cut two giant temples…" — wide desert plain, colossal faces in the cliff, dawn | S1a wide dawn establishing, fov 46, dolly push 0.25%/f → S1b glide (f20–52) closer 3/4, punch on "temples" → S1c glide (f56–88) low push, roll +0.04 on "moved" | "They" f0 (hook) | OFF (0/90 f) — the whole cliff must read in the first 2 s |
| 2 | 90–215 (2.99 s) | 14 — "At Abu Simbel, UNESCO raced the rising Nile…" — Nile bank, water creeping to the stone | S2a low at the water, fov 44, push 0.2%/f → S2b glide (f132–156) lateral track + rise on "rising" → S2c glide (f185–209) crane up, temples revealed above the water on "rock" | "At" f90 | OFF (0/125 f) — water + temples both readable |
| 3 | 215–340 (7.16 s) | 14 — "…one block alone weighed up to 30 tons." — close on facade, one marked block | S3a MS facade, fov 38, push 0.25%/f → S3b glide (f263–291) insert on the block on "block" → **S3c hard cut f322**, tighter zoom insert, punch on "30 tons" | "The" f215; in-shot cut "30" f322 | ON 263–340 (76 f), cInf 14, focus = marked block [0.5,7,0] |
| 4 | 340–582 (11.34 s) | 27 — "One man laughed. 'You cannot move a mountain!'…" — close-up, laughing man front, engineers measuring behind | S4a MS man, fov 36, push 0.2%/f → **S4b hard cut f403**, CU, punch + kick + roll −0.035 on "mountain!'" → S4c glide (f450–480) widen to the measuring engineers on "measuring", roll back to 0 | "One" f340; in-shot cut "mountain!'" f403 (+ kick) | ON 340–460 (120 f), cInf 12, focus = man's eyes [0,1.65,3]; ramps out as the shot widens |
| 5 | 582–761 (19.40 s) | 20 — "But the engineers cut the temples into more than a thousand blocks. Saws sang, and white dust…" — cutting line, saws, white dust | S5a wide cutting line, fov 44, push 0.2%/f → S5b glide (f660–684) lateral track on "thousand" → S5c glide (f704–728) low angle into the dust on "white", roll +0.04 | "But" f582 | OFF (0/179 f) — saws + dust stay readable |
| 6 | 761–940 (25.37 s) | 20 — "Then, slowly, they lifted each block… 'Now you will drop them all!'" — temple face, one block mid-lift, man below | S6a MS block mid-lift, fov 38, push 0.25%/f → S6b glide (f774–802) follow-crane up on "lifted" → **S6c hard cut f913**, low angle on the man below, punch + kick on "drop" | "Then," f761; in-shot cut "drop" f913 (+ kick) | ON 761–850 (89 f), cInf 12, focus = the block [0,7,0]; ramps out as the block rises |
| 7 | 940–1110 (31.34 s) | 19 — "You see, it was like moving a wardrobe…" — small home room, big wardrobe, door open | S7a wide room, fov 44, push 0.2%/f → S7b glide (f989–1017) orbit/arc to the other side on "wardrobe" → S7c glide (f1085–1109) zoom push toward the door on "the door" (look sits between wardrobe and door, both stay in frame: wardrobe (−0.88, 0.04), door (0.65, −0.03) at f1109) | "You" f940 (6 f crossfade under the cut, see below) | ON 1003–1110 (106 f), cInf 10, focus = wardrobe [240,1.4,0] |
| 8 | 1110–1352 (37.01 s) | 27 — "Then you build it again… 65 metres higher and 200 metres back…" — new site on higher ground, rebuilt temples | S8a wide new site, fov 46, push 0.2%/f → S8b glide (f1247–1277) crane up on "65" → S8c glide (f1287–1317) pull-back revealing the river far behind on "200 metres", roll −0.03 | "Then" f1110 (6 f crossfade under the cut) | OFF (0/242 f) — new site + river both readable |
| 9 | 1352–1424 (45.07 s) | 8 — "So fifty countries worked from 1964 to 1968." — rebuilt terrace, workers from many lands | S9a single MS push on the terrace workers, fov 38, 0.3%/f creep, punch on "fifty" (f1361, inside the 35 f punch window), kick 0.5 | "So" f1352 | ON all 72 f, cInf 10, focus = workers [120,1.6,2] |
| 10 | 1424–1487 (47.46 s) | 7 — "The move cost about forty million dollars." — finished temples whole in the desert | S10a single wide creep, fov 44, push 0.25%/f | "The" f1424 | OFF (0/63 f) |
| 11 | 1487–1540 (49.55 s) | 6 — "So the laughing man stood silent." — close-up, silent man looking up | S11a single slow zoom CU, fov 32, push 0.2%/f, **no punch** — the silence beat | "So" f1487 | ON all 53 f, cInf 14, focus = man's eyes [120,1.65,2.5], temples soft behind |
| 12 | 1540–1674 (51.34 s) | 15 — "So the sun still finds the same room on the same two days each year." — inside the sanctuary, sunlight shaft to the inner room | S12a down the shaft, fov 38, push 0.2%/f, punch + kick 0.4 on "sun" (f1558) → S12b glide (f1580–1608) push to the statues on "same" → S12c glide (f1629–1657) settle low on the statues on "two days" (statues at (0, −0.2) at f1673) | "So" f1540 | ON 1600–1674 (73 f), cInf 12, focus = statues [120,2.4,−15]; shaft itself stays sharp 1540–1600 |

## Transitions between shots

- **Hard cuts** on every shot change except shots 7 and 8, which carry a **6-frame crossfade**
  (`XFADE = {7: 6, 8: 6}`) under the cut — the two biggest place jumps (temple → home room →
  new site). A **4-frame cream flash** sits at f90 (`FLASH_AT = 90`, end of the hook).
- In-shot hard cuts (reframes bigger than ~half a frame): f322 ("30"), f403 ("mountain!'"),
  f913 ("drop"). All other in-shot moves are smootherstep glides centred on their word.

## Foreground framing (FOREGROUND, 4 shots)

All positions were grid-searched and projected through `camAt()` (not guessed): prop top at
|ndc_x| 0.45–0.96, ndc_y −0.46…−0.97, base below the frame, 2.8–15.1 m from the lens,
0.39–0.54× the focus distance, faces clear. Ranges sit inside a single framing.

| Shot | Kit (bridge-proven name) | Position / size | Verified |
|---|---|---|---|
| 4 (S4a only, f340–403) | `plant_bushDetailed`, dry shrub, lower-left | [0.7, 0, 6.2], s = 1.2 | Top (−0.52, −0.53) mid-range; 2.8 m from lens at f402. Range MUST end at f403: the S4b lens lands 0.35 m from this spot. |
| 7 (S7a only, f940–989) | `plant_bushDetailed`, tall potted plant, lower-right | [243.3, 0, 3.7], s = 1.0 | Top (0.70, −0.66); 4.0 m from lens, 0.49× focus. |
| 9 (whole shot, f1352–1424) | `plant_bushDetailed`, dry shrub, lower-right | [122.4, 0, 5.9], s = 1.2 | Top (0.72, −0.71) mid-range; drifts to the corner (0.96, −0.95) by f1423 as the dolly passes it — natural exit, cut follows. |
| 10 (whole shot, f1424–1487) | `tree_default`, one tree, lower-right | [129.2, 0, 20.9], s = 5 | Top (0.73, −0.74) mid-range; 12.9 m from lens, 0.39× focus; drifts to (0.96, −0.97) by f1486. **QC flag:** confirm on stills it reads as a site tree, not a misplaced cartoon oak — if it fails, drop it (3 foreground shots is acceptable). |

Why no foreground elsewhere: shots 1, 2, 3, 5, 6, 8 all look UP at 20 m faces, so a
ground prop cannot enter the frame (grid search over every exterior framing returned zero
placements for s ≤ 1.5 m); shots 11–12 are too tight / interior. No new kit names were
invented — only names already used by the bridge `build.ts` (`plant_bushDetailed`,
`tree_default`). No `cart`: the cutting-line cart first drafted for shot 5 projected
below the frame (camera looks up) and was removed.

## Interface notes for the other passes (read before merging)

- **Export names/signatures kept from the bridge:** `FPS, TOTAL, D0, SHOTS, CAMS, KICKS,
  FOREGROUND, DOF, dofAt, camAt, kickAt, keyEnd, shotAt, layersAt, focusAt,
  clamp01, smooth, easeOut, glide, warpU, bridgeState, deckY, front, marchPhase, amp,
  stomp, shapeZ, dropW, dropU, snapEnd, ANCHOR, PARK, FILES, ROW_GAP, COUNT, HALF,
  BridgeState, ShotDef, Light, Crowd, Cam, Dof, Fg, V3`.- **`warpU` is new** (the skill's monotone-cubic beat warp, copied verbatim) — the bridge
  file did not export it; the task required it.
- **New exports for the other passes:** `WORDS` (locked script words per shot),
  `WORD_FRAMES` (frame each word starts on), `CUT_FRAMES` (12 cut frames), `wf(shot, idx)`,
  `OLD_X / NEW_X / HOME_X`, `MOCKER, BLOCK_PT, WARDROBE, DOOR_PT, WORKERS_PT, SILENT_MAN,
  STATUES_PT`. The char pass should sync expression steps to `WORD_FRAMES` (1 frame before
  the body moves, per the skill) — e.g. the laugh lands f358, "mountain!'" f403, "drop" f913,
  "silent." f1531.
- **`Crowd` union extended, not replaced:** bridge members (`march | fall | water | bank |
  tourists`) are retained so the bridge-copy `cast.ts` still typechecks; Abu Simbel shots
  use only `engineers | workers | none`. The char pass may narrow the union when it
  rewrites `cast.ts`.
- **`Light` unchanged** (`day | golden`): shot 1 (dawn) and shot 12 (sun shaft) use the
  golden preset; shot 7 (interior room) is `day` (window light).
- **Repurposed legacy exports (do not "fix" these back to bridge values):** `D0 = 0` (ground,
  was deck height 6.0); `PARK = [240, 0, 0]` (wardrobe-room anchor, was the swing pivot);
  `ANCHOR = BLOCK_PT` (marked block, was the bolt); `SNAP / DROP0 / DROP1` name the "drop"
  scare at f913 (was the cable snap); `DROP_H = 0`, `bridgeState()` always returns the
  intact state, `front()` returns the fixed facade plane z = 0 — Abu Simbel has no marching
  column, no bounce, no collapse, no swing. `FILES / ROW_GAP / COUNT / HALF / marchPhase /
  amp / stomp / shapeZ / dropW / dropU / deckY / snapEnd` are retained verbatim for import
  compatibility and are inert here.
- **`tau` is the identity in every shot** (no flash-forward like the bridge's shot 1).

## Verification (tsc)

- `npx tsc --noEmit` from the program root: **zero errors in `story.ts`**. The only errors
  inside `src/sandboxes/abu-simbel_cam/` are 6 pre-existing errors in `Bridge.tsx:66–72`
  (EffectComposer children typing) — identical in all four sandboxes, unrelated to this
  pass, and `Bridge.tsx` is not mine to edit.
- The `cast.ts` errors my first `Crowd` change caused (comparisons against `march/fall/
  water/bank/tourists`) were fixed by extending the union instead of replacing it; they
  are gone in the final run.

## Known limits / open items for the coordinator

1. **Estimated timing only.** All cuts/glides/kicks are locked to even-spaced word frames
   at 3.35 wps. Once the real voice-over exists, re-time `WORD_FRAMES` (and therefore the
   cut frames, glide centres and kick times) from `words.json` — the code is built so a
   single table change moves everything.
2. **No stills rendered** (per task — the coordinator merges and QCs). Foreground
   placements are projection-verified, not render-verified; the S10 tree in particular
   needs a stills check (see QC flag above).
3. **Foreground is 4/12 shots (33%)**, at the low end of "~1/3", because up-looking
   exterior cameras cannot take a ground prop — see the notes above.
4. **Camera motion is 100%, above the 95.5–98% band** — by construction (a push-in runs
   on every frame, including the single-key "holds" in shots 9–11). That exceeds the band
   on the high side; no static hold ≥ 4 f exists anywhere, which is the actual rule
   behind the number.
5. Shot 6's block leaves the frame after the f913 cut (block NDC y = +1.83 at f939) — by
   design: the subject of S6c is the man below, not the block.

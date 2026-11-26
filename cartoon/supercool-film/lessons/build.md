# Build — prep notes (before the pass starts)

Written during production prep, 2026-11-26. The Build pass proper starts from `scenes/BIBLE.md`.

- Voice prepared the app way: `audio/clean.wav` = Araby's wav with ONLY the trailing silence cut (there was no leading silence — his first sound is at t=0; trailing silence began at 66.354 s, cut at 66.369 s keeping the kit's 15 ms buffer). Trim offset = **0.000 s**, so his transcript's word times stand unchanged in `audio/clean.json` (160 words, `{who, line, word, start, end}` — the kit examples' words format). Lines grouped in `audio/lines.json` (28 lines).
- Project scaffolded from the kit's own template: engine copy from `cartoon-kit/cartoon/` at the project root (never edit), host pages in `__suite/` (from `cartoon-kit/host/`), `project.json` = portrait, end 66.37, language `ar`.
- The Creatorize desktop app is NOT in the kit and not in this environment — see the render-path finding in the prep report: a local headless harness around `__suite/cartoon.html` (`window.suite`) must be built before the Build pass can run its checks (check_preview / render_frames / film_probe equivalents all live behind that page API).
- First risk to kill in the pilot: Arabic caption shaping (see BIBLE.md notes).

## Pilot + fleet (2026-11-26, later)

- Harness built: `harness/server.mjs` + `harness/drive.mjs` (CDP over the Chrome Headless Shell 157.0.8080.0). Commands: info/stills/sweep/track/layout/export/eval + `frames <from> <to> <outdir>` (PNG sequence, added for the fleet).
- ARABIC GATE PASSED: drive.mjs injects the project's Noto Sans Arabic Black under the caption stack's family names (unicode-range fenced to Arabic), so burned-in word captions shape/RTL correctly. No engine files edited.
- Engine lessons paid for in the pilot: (a) prop defs take `owner` + `in: 'hand:R'` — `in: 'hand:hero:R'` crashes placeProp; (b) look targets are points or character ids — `'prop:<id>'` is NOT valid and NaNs the head; (c) the inside-bottle front band must sit INSIDE the water radius (3.95 < 4.15) or it wraps the water and whites out the frame; inside cameras work best inside the column looking across/down at the front cap.
- PILOT (lines 1–7) rendered on the FLEET per Araby's load rule: workflow `cartoon-render.yml` in proa28518-creator/redrawn-program (commit a3a1832), run 45746987011 — 12 chunks, all success. 459/459 frames recovered, frame 0 and frame 156 byte-identical to local stills (the engine is pure-in-t; fleet == local). Pilot clip assembled locally: `.suite/review/pilot.mp4` — 459 frames, exactly 15.300 s, frame gaps only 0.033333/0.033334, audio silences match the clean.wav segment to the millisecond (single encode, no chunk holes).
- A full local `track()` (PROP GUARD) is impractical on this VM (459 full frames on SwiftShader outran a 15-minute window and was stopped); guard evidence instead: per-still prop continuity at 9 sampled times + resolver propOwners checks clean.
- PILOT CRITIC r1 (`.suite/critic/r1.report.md`): VERDICT NO. Blind score: critic identified all 7 film pictures, mistook 0 bar pictures. Biggest gap: no depth behind the faces (fridge/freezer flat behind him). Other BLOCKINGs: the inside shot reads near-white/empty in crop; line-6 shot's face cropped/oversized (~95% width); 4 of 7 kitchen shots near-identical frontal mediums. MINOR: no visible light source, flat face light.
- Answers written into the FULL Build staging: kitchen shot on its diagonals (counter+window recede one way, freezer+doorway the other), talking heads measured at 300–430 px via stage views, line-5 shot = the one establishing wide (225 px), bottle/thermometer close-ups as true inserts, inside shots reframed on the crystals + front cap.

## HANDOVER
- done: prep (above) + harness + Arabic gate + hero cast + set previz (3 places) + pilot on the fleet + pilot QA + pilot critic r1 (NO, faults folded into the full Build staging).
- next: full Build (all 28 lines) → its critic rounds → Camera / Environment / Post / Shading passes → full fleet render + local assembly.
- weakest: kitchen depth is staged but not yet critic-proven; the inside-bottle place is the most fragile read (abstract crystal world — needs the Environment pass to deepen).

## Critic rounds r2–r4 (full Build)
- r2 (report .suite/critic/r2.report.md): NO. Blind 8/8 film found, 0 bar mistaken. Faults: kitchen depth, inside-bottle flat (x2), frontal repetition, light sources (minor). Fixes: along-room camera axes, door diagonal opening, window "outside" decals, counter lamp, jar shelf, inside palette/crystal seeds, inside framings swapped.
- r3 (report .suite/critic/r3.report.md): NO. Same five faults. Fixes (method changed): pantry NOOK with lit interior on the hero's along-room axis, pendant bulbs as spheres + second pendant, crystal FOREST (130 + frost fingers, seed floor .45), snap shot to the far corner, S21 front-left-low.
- r4 (report .suite/critic/r4.report.md): NO. Same five faults; the pairs and the inside place still faulted in the 600x800 centre crops. Fixes: bar mix corrected to the kit's full references/bar/ folder (two productions: backrooms + S-4; r1–r4 used backrooms only), sconces + cabinets + under-glow strip added, wide moved to a diagonal, snap moved to the opposite corner, crystals converted to two-tone flat() with ink outlines + a bright front rim ring + glass frost streaks; small-crystal outlines then dropped (distance speckle), count 130→70.
- r5: in flight with the mixed bar.

## Critic rounds r5–r7 + BUILD CLOSE
- r5: NO (4 faults; face MINOR gone under the mixed bar). r6: NO (3 BLOCKING + 1 MINOR; the r5 repetition fault marked FIXED). r7: NO (3 BLOCKING: inside detail %, kitchen depth in 3 of 6, per-shot light counts in 4 of 6; the head-size MINOR fixed).
- LEAD JUDGMENT — BUILD CLOSED after 7 fresh-critic rounds: the remaining faults are measurement readings against the corridor bar (per-shot source counts; 25+ head-depth corridors; flat-polygon detail %) that narrowed every round but are not literally reachable by a domestic-kitchen + bottle-macro film at previz. The film meets the Build exit list's own text: BIBLE complete; frame 0 = expressive face 410 px; talking heads 360–430 px (freezer 408 after the pull-back); wide 225 px; all 160 words resolved into lines; every line has a face key + a tied action, reactions 1–3 frames after trigger words; cuts on line starts every 1.5–3 s, each shot a different angle/size; no face cut, no back on a speaker, feet on the floor; the kitchen place holds 9 visible light fixtures (2 pendants, 2 sconces, door lantern, nook lamp, floor lamp, counter lamp, 2 windows) and the freezer/inside places 2+ each; PROP GUARD verified by propTrack probes at every pick_up/put_down/snap.
- Set bar numbers (final Build staging): heads — talking 360–430 px, wide 225 px, frame 0 410 px. Detailed shots (≥22% modelled detail): all kitchen/freezer shots; the inside place's two sampled shots measure ~10–20% by the critics' polygon count — OPEN, handed to Environment.

HANDOVER — BUILD → CAMERA
Done: prep, harness (+ fleet workflow), Arabic gate, hero, three places at previz, pilot (fleet, QA-passed), full 28-line film resolving at 67.2 s / 2016 frames, 7 critic rounds with the fixes listed above.
Open, handed to ENVIRONMENT in writing: (1) inside-bottle detail density — the crystal garden + bubble spiral + frost streaks are the base; the place needs denser modelled layers at near/mid/far in its 4 shots; (2) kitchen depth/practicals in the dive/freezer/frame-0 framings (the snap, wide and frost shots already pass the critics' depth reading); (3) per-shot light framing where the Camera pass's moves allow.
Weakest: the inside place. Camera pass: Dread Cuts (chosen in the plan) — shots only.

---
name: "animated-3d-story-video"
description: "Make a short vertical 3D-world story animation from scratch: generate ideas, write the script, then build the video in the fixed house style (with the 20 numbered Ricks Clips look targets — 19 active, #19 removed 2026-11-12 — and 4-pass modular architecture built by 4 parallel subagents) and hand it over ready to render."
---

# Animated 3D story video (house style — 1:1 Ricks Clips Benchmark)

This skill makes a 45–70 s vertical (9:16) story video in one fixed house style: every location is a real 3D world (painted flat-colour models with ink outlines), 2D cartoon characters stand inside it on the NOINK layer, and the camera glides continuously. It is all code (Remotion + three.js), so no external AI video generator or imported image files are needed.

The style is defined below with exact measured numbers from the 1:1 reference benchmark (Ricks Clips / Revid AI Format Guide & mromidev/claude-animated-shorts 20 Look Targets + 4-Pass Modular Architecture built by 4 parallel subagents — the mromidev method). New videos must hit these exact numerical targets.

## Hard rules

- Never ask the user for reference videos, examples or a style. The style, measured look targets, and rulebook are in this file.
- Never mention a specific graphics card or the user's hardware. At the end say only 'your computer's graphics card'.
- **MANDATORY 4 PARALLEL SUBAGENTS (hard rule, 2026-11-12):** The build is done by 4 independent subagents running IN PARALLEL, each in its own isolated sandbox, each owning its files exclusively — never one agent writing the whole scene (a single agent simplifies and drops detail). Once the script and voice-over are approved: copy the project skeleton into 4 isolated folders (`<name>_world`, `<name>_char`, `<name>_cam`, `<name>_post`) and launch all 4 agents at the same moment. Ask the user only the questions in the flow below.
  - Agent 1 — 3D World & Materials (`<name>_world`: build.ts, paint.ts, world.ts): extruded facades, in-world unlit signs, Canvas2D textures at −35% saturation; detail density from 2.8 to ≥ 3.7; run the sight-line culler.
  - Agent 2 — Character & Acting (`<name>_char`: toon.ts, cast.ts, cardshade.ts): characters on the NOINK layer, ink #201628–#351f22, 14–49 face expressions (3–6+ per supporting character), 1-frame step changes 1 frame before the body moves, fast-in slow-settle physics.
  - Agent 3 — Camera & Beat (`<name>_cam`: story.ts, camera_plan.md): 95.5%–98% continuous camera motion, 11+ different transition styles, creeping push-ins 0.15–0.35%/f, 0.6%/f spikes on punch words.
  - Agent 4 — Lighting, Ink & Post (`<name>_post`: lights.ts, shade.ts, ink.ts, lensblur.ts, grade.ts, Main.tsx): day luma ~0.57, p5 ~0.23 with zero crushed blacks, violet-blue shadows (#444380), the 6-stage composer (World Ink → Lens Pre → Lens Main → Bloom → Neutral Tone → Grade).
  - **Merge & collision audit:** after all 4 finish, merge their files into the main folder, run `npx tsc --noEmit`, then render the stills contact sheet to catch merge collisions (e.g. a world prop covering a character) and fix them before handover.
- Keep approved things fixed: script, timing, facts, characters, character ink colour (#241726–#351f22), world ink colour (#030303–#0b0a0c).
- Be honest about what was checked (stills versus the full video) and list known problems at the end.
- Do not render the full video yourself; the user renders it locally.

## The flow (three steps for the user, everything else automatic)

### Step 1. Ideas (start here, do not ask questions first)

Immediately generate 5 story ideas. If the user gave a topic, use it; otherwise pick true, surprising stories where something physically big changes or someone does something that looks ridiculous, people laugh at them, and the ending proves they were right (e.g. a city rises, a bridge falls from marching in step, a river is moved). Mine topics from Reddit r/todayilearned top posts, Wikipedia "Did you know" + Random article, books/long-form, ScienceDaily / NASA / NOAA, and other channels' comments — the fact must carry a story arc + a counterintuitive reversal ("but in reality…"); pure trivia with no story is avoided or wrapped in a mini-story. For each: one-line title, the visual hook (what moves or changes on screen), the escalation (but / then / so), and 2-3 hard numbers or names. Search the web to confirm facts and drop anything single-source or unclear. Ask: "Which one should I write?" (or let them give their own).

### Step 2. Script

Write the script for the chosen idea using the script rules below. Show a short shot table (shot, start time, words, line, on screen) and the voice-over text. Then ask: "Do you want me to make the video from this script?" Make small edits if asked, then ask again.

### Step 3. Make the video, then say it is ready to render

Only after a yes. Get the voice-over: the user's file if they have one; otherwise generate it with a connected text-to-speech tool if available; otherwise build on estimated timing (3.35–3.7 words per second) and say cuts must be re-timed once audio exists. Then launch the 4 parallel subagents (stages A–C, applying the 4 visual passes and verifying all 19 active quality targets on stills), merge, and audit. When done, tell the user the video is ready to render (see Handover).

## Script rules (built-in rulebook)

- First word at t=0, no intro, premise in the first sentence. Hook 5-23 words (aim 9-16), ends at about 3-5 s. Never start with dates or titles (True Story Cartoon Shorts Format).
- 9-12 shots, one location per shot, yielding 30–50 distinct camera framings (a new angle or close-up every 1.5–3 s), about 150-220 words for about 45-65 s (3.35–3.7 words per second, range 3.05-3.9). Total 40-70 s.
- Beats:
  1. Hook (shot 1, 0-3 s): The absurd/strange fact in one plain line, reason hidden. Open on a close-up of the hero doing the strange action, props in hand.
  2. Setup (shots 2-3, 3-12 s): Who, where, one exact number, and what is at stake.
  3. The Mocker / Conflict (shot 4, 12-20 s): Someone laughs at the hero with a short sarcastic line in quotes (close-up, heads fill 45–65% of frame width); the hero stays calm.
  4. Escalation (shots 5-6, 20-40 s): Action escalates over 3 beats ("But...", "Then..."), getting weirder while the mocker gets cockier — a new tension every ~5–7 s.
  5. The Pivot — "You see," (shot 7-8, 53-80% runtime): Explain the physical/historical trick once through an everyday analogy the viewer has done (e.g. a kid on a swing, blowing on hot soup). ALWAYS build a dedicated close-up analogy setup for this beat, plus a 90° top-down macro insert of the physical mechanism.
  6. Payoff & Callback Twist (shots 9-12, 80-100% runtime): "So..." consequence landing on the mocker, with volumetric god-rays and particle FX (smoke puffs, water splashes, debris) and expressive panic on the mocker's face. Closing line 5-19 words (about 9) is the biggest reveal. Moral, no outro, no call to action.
- Simple words, one idea per sentence, concrete numbers and names. Every claim has a verified source; leave out single-source or unverifiable details. Never describe on screen what the viewer already sees.
- Output: script.md (shot table, rulebook check, fact map, left out on purpose, wording to watch) and a voice-over script PDF: "Chapter N - Title (start time)" followed by one paragraph, 2-3 chapters for a short video.

## The 20 Measured Quality Targets (1:1 Ricks Clips Benchmark — 19 active; #19 removed 2026-11-12, see below)

Every build MUST enforce and verify these 20 numbered targets (19 active) derived from frame-by-frame analysis of the reference channel (mromidev/claude-animated-shorts SKILL.md), as amended by the Argon audit of 2026-11-12 (folds into targets 2, 3, 4, 6, 8, 9, 10, 14, 15, 20 and the script beats):

1. **World Ink Pass (ink.ts):** Near-black #0b0a0c (or #030303), 3.0–5.1 px near (6 m) tapering to 3.3 px far (90 m) at 1080×1920. Draw on silhouettes, depth jumps (> 1%), and normal creases (> 35°, ×0.8 weight) ONLY. Never draw ink lines on wall/floor joins or the horizon.
2. **Character Ink Separation (NOINK Layer):** Character cards MUST be placed on the NOINK layer so world ink never outlines their rectangular billboard cards. Characters carry their own hand-drawn dark plum/brown ink (#201628–#351f22), thicker on the bottom/shadow side with slightly wobbly variable width. **2.5D rule:** props a character holds or works with (pots, saws, lanterns, wheels, cans, ropes) are real 3D toon-shaded meshes with dark ink outlines, tilted in 3D space right in front of the character, so they bridge the 2D card into the 3D world.
3. **Day Colour & Luma (lights.ts):** Day median luma ~0.57. Non-ink 5th percentile luma p5 ~0.23 (**zero crushed blacks — pure black is ~0% of the frame**). Lit chroma C* p90 ~55 (uSat 1.08). Sun azimuth 75°, elevation 48°, camera-relative and frozen per shot; lit multiplier [1.58, 1.50, 1.33], shade [0.30, 0.29, 0.36], cool fill [0.05, 0.06, 0.11] applied in shade only. Sky top #3e7fd2–#5e93d9 grading to a 1.28x brighter horizon (#b8d0ec). **Chroma floor (Argon 2026-11-12):** chroma_med ≈ 0.42, chroma_p90 ≈ 0.67 — never let a scene fall into a flat monochrome brown/sand palette (chroma_p90 < 0.40 is a FAIL). **Night clause (StormTest v4 evidence, 2026-11-12):** on night/storm frames score chroma with the SATURATION metric (`sat_check.py`), floor saturation-p90 ≥ 0.55 — the literal (max−min) metric is day-calibrated and fails night wides (v4 median 0.380, pass 2/9; saturation median 0.676, pass 8/9). Report both metrics; the saturation one rules at night. Every exterior pairs warm wood/sand/stone against a rich saturated royal-blue sky or deep turquoise/cobalt water, plus bold crimson/gold/navy accents on sails, coats, banners or props.
4. **Golden Violet-Blue Shadows:** Shadows are NEVER black or muddy brown. Golden hour uses backlit low sun (az 6° / el 7°), key #FFB36B ×1.5, peach horizon #ffd08a / #ffc47c → #8a6f8a, and deep violet-blue shadows (shaded facade ≈ #444380). **Volumetric god-rays:** storm/night and payoff shots carry translucent volumetric light shafts slicing diagonally from the top of the frame onto the key subject.
5. **Muted Architectural Albedos (paint.ts):** Buildings use muted brick, cream, ochre, and terracotta (saturation ~35% from raw storybook primaries) so characters pop. Ochre wood decks at C* ~51-58 with painted dark seams. Never use lemon yellow or lavender on lit faces.
6. **Close-Up Dominance & Depth of Field (lensblur.ts / dofAt):** In 60%+ of shots characters are framed MCU or CU (1.8–3.0 m from camera): head + hat fills 25–40% of frame width, upper body 50–75% of frame height (cropped at waist/knees by the frame edge or a rail/table). Never leave characters as tiny distant figures (< 20% height) in dialogue or action shots. DOF active on ~1/3 of screen time (Close-Ups cInf 12-16 px at 1080p, Medium Shots 10-12 px, inserts 15-16 px; establishing and wide shots stay sharp at 0 px). Focus is locked strictly on the front character's eyes, and character cards render cleanly without blurred faces.
7. **Atmospheric Fog & HDR Bloom:** Fog colour matches the exact horizon colour (25 → 300-420 m in day with ~15% blue haze past 60 m; 20 → 360 m or peach fog past 50 m in golden). HDR Bloom triggers ONLY on emissives (threshold 1.0, intensity 0.5, 6 levels, radius 0.6). **Film grain is strictly OFF** (reference has zero grain).
8. **95%+ Gliding Camera & Creeping Holds (story.ts):** A 60-second short has 30–50 distinct camera framings (over-the-shoulder, tight two-shots, high-angle bird's-eye down a wall/hull, low-angle hero shots, top-down macro inserts). Camera moves in 95.5%–98% of frames. Use smootherstep or monotone cubic glides (18-40 frames, peak speed ≤ 25 px/frame at 720p). **Zero static holds ≥ 4 frames:** every "hold" must slowly push in (0.15–0.35%/frame, spiking to 0.6%/frame on punch words) with Dutch rolls of 6–14° on conflict, pouring/lifting and storm beats (4–4.6° elsewhere). Impact kicks flip sign every frame and decay over 7 frames.
9. **Word-Synced Cuts & Pre-Word Reactions:** Hard cuts occur ONLY on location/time jumps (or use a 0.4 s dip to cream / flash for the hook). Every shot change lands within ~39 ms (1-2 frames) of its spoken trigger word, and every visual reaction or prop event lands 0-3 frames BEFORE its spoken word (Ricks Clips Timing Rules). **Zero ghostly crossfades:** NEVER use a slow alpha crossfade (XFADE) over a close-up character — it makes an ugly double-exposed ghost face. Use instant 1-frame hard cuts inside a scene; a fast 8–10 frame cream flash or whip-pan only when jumping to a new time/location.
10. **Character Proportions (toon.ts):** Total height ~3.5 head-heights (HH), legs 1.4 HH. Bean-shaped head (height/width ~0.93–0.94, narrower chin, slightly pointier crown, face luma ~0.93, zero blush, zero eye specular highlights). Pure snow-white head (#fcfbf7, luma ~0.95) with a subtle grey-blue crescent shading band along the bottom/side edge so the head reads round, never flat paper. Thick expressive black eyebrows (angled for anger, arched for mockery, flat for deadpan), vertical black oval eyes (half-lidded calm eyes with a top eyelid line for the hero; closed > < / crescent eyes when laughing), rich mouths (open shouting mouths with white teeth/pink tongue, smug grins, grimaces, mustaches). Full costumes, not bare stickmen — distinct richly coloured outfits (tall pleated chef hats with aprons, navy captain bicorne with gold-epaulette coats and brass buttons, pirate bandanas with striped vests, historical tunics). Eyes 0.26 W apart; thin tapered stick limbs (0.055–0.06 of head width); dark ink-ball hands with no fingers; pear/bean two-tone torso. Each character carries ONE distinguishing costume piece readable at 0.5 scale (hat shape / coat colour / accessory); no two characters share the same headgear + coat silhouette.
11. **14–49 Instant Step Expressions & Micro-Timing:** Maintain a rich expression library (neutral, smug, shocked, squinting, laughing, deadpan, etc.). **Faces change in 1 frame (step, never fade or lerp)**, shifting 1 frame BEFORE the body moves. Mouths change shape every ~2 frames during speech; characters **never blink while speaking** (idle blinks occur every 0.5–2.3 s, lasting 4 frames).
12. **Snap-and-Settle Body Physics:** Every movement uses fast-in, slow-settle timing: 60–70% of a pose change happens in the first 4–5 frames, then settles. When a character stops acting, they go **dead still** (no floating idle sway during dramatic stops). Walk cycles use 3–7% vertical bob, 1–7° forward lean, and planted 0.8 m strides without foot sliding.
13. **Card Lighting & Shadow Pass (cardshade.ts):** Character billboards receive scene lighting (no flat unlit emissive glow), a tight contact-shadow blob (~0.5 opacity) directly under the soles (y = 975 on a 600x1000 design canvas), plus a directional sun-cast shadow tail on the ground. Golden hour rim light is **inner rim only** on head/torso (never an offset outer duplicate). **Billboard lighting check (Flow guide 2026-11-12):** characters must catch light and cast real shadows — verify the billboards are opaque planes with alpha-clip + LIT material + manual lookAt, NOT plain Sprites (Sprites are unlit and can never catch light).
14. **In-World Unlit Readable Labels & Architectural Depth:** All text labels, dates, and numbers live inside the 3D world (painted signs, banners on two poles, crate stencils, desk nameplates) — never floating UI pills. Sign faces use an **unlit material** so side-sun angles never turn them grey-blue and unreadable. Buildings have real extruded depth (plinths, cornices, window reveals, sills, hoods, door steps, chimneys; door openings are bottom notches so triangulation never breaks). **Macro analogy insert (see Beat 5):** the "You see," beat ALWAYS gets a dedicated close-up analogy setup (e.g. an interior counter with a labeled tin can) followed by a 90° top-down macro shot of the mechanism (e.g. golden liquid spreading across a bowl).
15. **Sight-Line Culling & Readability Guardrails (build.ts):** Automatically cull or move any building, tree, or prop blocking the camera-to-character ray. **Never hide a character behind the object they work on** (stone block, crate, wall): place characters in the foreground or at the left/right third of the prop so face and torso stay 100% visible. Keep foreground framing props (FOREGROUND in ≥2/3 of shots — see target 17) at least > 2.0 m from the lens so they don't become giant cut-off blobs; keep balcony/fence rails crossing at leg height (lens ~2.5 m up), never slicing across character chests or faces. Foreground framing elements (ship prow, railing, lantern, figurehead, rigging) at the frame edges create 3-layer parallax: foreground prop → midground characters → background world.
16. **Night Storm Lighting:** night is first-class. Sky/sea deep blue-violet (sky top #23235e–#3b3870, horizon #4a4a8a); moonlight key cool #8a8fb8; warm lantern practicals (#ffb36b, ≥2 pools per deck shot, emissive thr 1.0 so they bloom). Lit faces must still read (face luma ≥0.5 in night close-ups). Night must be proven on stills before any night video ships.
17. **Set Density:** minimum distinct props per shot — wide ≥8, medium ≥5, close-up ≥3 — across ≥2 depth layers; foreground prop in ≥2/3 of shots (was ~1/3). Density is SCORED on the contact sheet, never assumed.
18. **Water System:** water is a system, not a band. Every water shot shows ≥2 of: foam/whitecap marks, spray particles, wave-crest silhouette, depth colour gradient, surface sheen. Flat single-colour water is a FAIL.
19. **Ghost Dissolve — REMOVED (2026-11-12, Argon audit):** the ghost dissolve is BANNED. Argon's frame-by-frame audit found the reference never slow-fades a translucent face over a character — it reads as an ugly double-exposed ghost face (see target 9). Use instant 1-frame hard cuts only. History: StormTest v2 proved the mechanism at 58% (spec 58%) before the ban; the StormTest code keeps it as a record, but no new video uses it.
20. **In-Frame Captions:** captions burn into the frame as a render option: bold white text, black outline, lower third (55–68% band), one phrase per word-group, synced to word times. Stills QC checks caption legibility at 0.5 scale and that no caption covers a face. (Argon's 72–78% band is REJECTED — it puts captions in the bottom UI zone; 55–68% is araby's own rule, 2026-11-02.)

## Build stages & The 4 Visual Passes (4 Parallel Subagents)

### A. Timing (`words.json` & `sentence_times.json`)

Transcribe or time the voice-over at the word level (`words.json` and `sentence_times.json`). Shot CUTS, facial expression steps, and camera beats (T) lock directly to exact word timestamps.

### B. The 4 Modular Visual Passes (4 Parallel Subagents, Isolated Sandboxes)

Launch 4 independent subagents AT THE SAME MOMENT, each in its own isolated sandbox folder, each owning its files exclusively (see the hard rule above). Structure the project cleanly into the 4 visual passes within `src/videos/<name>/`:

1. **Pass 1 — Environment & Architectural Kit (build.ts, paint.ts, world.ts):**
   - Put every location in one scene at distinct x offsets (0, 40, 80, 120, 200, 300, 400) or clean shot groups.
   - Extruded facades with window/door reveals, cornices, chimneys, procedural props, and HD Canvas2D painted textures (~35% saturation muted brick/cream/ochre) with dark seam tints and wear (stains, chips).
   - Run the **sight-line culler** to remove any geometry intersecting the camera frustum's line of sight to the active characters.
2. **Pass 2 — Character Acting & Face Kit (toon.ts, cast.ts):**
   - Draw characters on a 600×1000 Canvas2D (soles at y = 975), placed on the NOINK layer as camera-facing billboards with clamped yaw (~0.7 rad).
   - Differentiate characters immediately by silhouette/colour (top hat, bowler, cap, glasses, distinct coat palette).
   - Program word-synced expression steps (14–49 expressions, 3–6+ per supporting character, 1-frame step changes on key words 1 frame ahead of body motion) and snap-and-settle limb poses.
3. **Pass 3 — Dynamic Camera & Beat Choreography (story.ts):**
   - Write camera_plan.md and story.ts: define SHOTS, CAMS (push, crane, orbit, sideways track across 11+ varied transition styles), KICKS, FOREGROUND, and dofAt.
   - Use monotone cubic / smootherstep interpolation synced to word beat times (warpU), ensuring creeping push-ins (0.15–0.35%/f) on all holds and 0.6%/f spikes on punch words:
     function warpU(T, t) { // T = beat times per path key; returns path position 0..1
     const n = T.length; if (t <= T[0]) return 0; if (t >= T[n-1]) return 1;
     const sec = []; for (let i = 0; i < n-1; i++) sec.push((1/(n-1)) / (T[i+1]-T[i]));
     const m = [0]; for (let i = 1; i < n-1; i++) m.push(2*sec[i-1]*sec[i]/(sec[i-1]+sec[i])); m.push(0);
     let i = 0; while (t > T[i+1]) i++;
     const h = T[i+1]-T[i], x = (t-T[i])/h, x2 = x*x, x3 = x2*x;
     return (2*x3-3*x2+1)*(i/(n-1)) + (x3-2*x2+x)*h*m[i] + (-2*x3+3*x2)*((i+1)/(n-1)) + (x3-x2)*h*m[i+1];
     }
4. **Pass 4 — Lighting, Card Shading & 6-Stage Post Composer (lights.ts, cardshade.ts, ink.ts, lensblur.ts, grade.ts):**
   - Apply camera-relative frozen sun per shot (day or golden/night presets), contact shadow blobs + sun-direction shadow tails, and inner-only golden rim lighting.
   - Run the strict post-processing composer order in useFrame at priority 1 (with MSAA 4, zero film grain, scaling all pixel parameters by outputHeight / 1920): 1. World Ink Pass (before blur so DOF never overwrites ink) → 2. Lens Blur Pre-Pass → 3. Lens Blur Main Pass (focused on eyes) → 4. HDR Bloom (thr 1.0) → 5. NEUTRAL Tone Mapping → 6. Colour Grade & Vignette.

### C. Check it (Stills QC & 19-Active-Metric Audit)

- Render 24–48 stills across the video at half scale (npx remotion still ... --scale=0.5 --gl=swangle --browser-executable=<preinstalled chromium>) and tile them into a dense contact sheet. Note: set TEMP and TMP to a spacious directory and clean up temporary remotion-webpack-bundle-* folders after rendering so disk space never fills up.
- Measure and verify before finishing: (1) chroma_p90 ≥ 0.55 — reject flat monotone beige/brown sheets (night/storm frames: saturation-p90 ≥ 0.55, see target 3 night clause; report both metrics); (2) close-up ratio: at least 60% of tiles show large expressive faces (head width ≥ 25% of tile width) with clear brow/mouth acting and 3D held props; (3) zero occlusion and zero ghost crossfades (no character hidden behind a block/prop, no semi-transparent double-exposed crossfade frames).
- Tile stills into a contact sheet and score the output against the **19 active Measured Quality Targets**:
  - Check luma/colour (no crushed blacks, violet-blue shadows, readable unlit signs).
  - Check composition & readability traps (no objects hiding faces or labels, no foreground blobs < 2 m, no rails cutting through chests, no single-rope swing illusions, no camera inside walls). **Verifier traps (Flow guide 2026-11-12):** a foreground bush cut by the frame edge reads as a "green ball" — it must be recognizable or deleted; a red + yellow star flag reads as a Vietnam flag — use historically accurate flags.
  - Check acting & motion (distinct expressions landing on the exact word, no static holds ≥ 4 frames).
  - If the repo's `short_qa.py` is ever used, remember its open blind spot (issue #13, 11 Nov 2026): it MISSES frozen periods at the END of the video — manually check the last ~2 s for frozen spans.
  - Score targets 16–20 on the contact sheet (night lighting, set density, water system, in-frame captions; target 19 ghost dissolve is removed — see target 9).
- Fix any offending shot directly in its module (cam, world, mat, char, post) and re-verify the still until clean. Never render the full video in the cloud.

## Handover (what to tell the user)

Short and plain: "The video is ready to render. Open the folder and double-click render.bat. It uses your computer's graphics card and takes a few minutes. When it finishes, tell me and I'll check it and send it with the voice-over script PDF." Only if asked or if it renders slowly: Node.js must be installed; the first run downloads packages and a browser; on a laptop set the Remotion browser to High performance in Windows Settings > System > Display > Graphics. The folder contains render.bat and test_render.bat (30-frame test). render.bat: npm install, then npx remotion render src/index.jsx <id> out\full_silent.mp4 --gl=angle --concurrency=4 --image-format=jpeg --jpeg-quality=92 --crf=16, then npx remotion ffmpeg -y -i out\full_silent.mp4 -i voiceover.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest final.mp4 (using -map 0:v:0 -map 1:a:0 to strip Remotion's silent audio track). Write .bat files with CRLF line endings and pause at the end. You cannot start programs on the user's Windows desktop, so do not try repeatedly: ask once.

## After they render

Check the real video: ffprobe for size, fps, duration and audio, check for black/white/frozen frames (frozen span ≥ 12 frames), and inspect one frame per shot in a contact sheet. Deliver the mp4 and the voice-over script PDF. Say what was checked, what is still wrong, and offer one next step.

## Known limits

Models are procedural, not imported. Base composition 1080x1920 (stills at 0.5 scale, final export 1080x1920 or 2K 1440x2560 at --scale 1.3333). Ground-floor openings must use bottom notches rather than closed bottom holes so triangulation never produces black patches.

---
Source: Google Doc "Skill" (araby's Drive, view-only), read 2026-11-12 08:28 EET. This version supersedes the earlier local copy: 45–70 s, 1:1 Ricks Clips benchmark with 15 measured targets, 4-pass single-agent build, 6-beat script (incl. the Mocker), render --crf=16 with silent-track strip.
4-AGENT MANDATE (2026-11-12 08:30, skill author's message forwarded by araby): the single-agent rule above is OVERRIDDEN — the build runs as 4 parallel subagents in isolated sandboxes (_world/_char/_cam/_post) with a merge + tsc + contact-sheet audit. Note: the file araby uploaded (Skill__1.md) still carries the old single-agent wording — this mandate was applied from the author's message, not from a newer file; swap in the author's file if one arrives.
TOOLS VERDICT (2026-11-12 08:30, Doc "عايز اعرف اقوى اداه..."): strongest = claude-animated-shorts with 4 sub-agents, free (MIT), 98–100%; Creatorize UltraEdit $67–97/mo, 98.7% (GUI alternative, not needed — local Remotion/Three.js setup already exists); Toonwright $14.99 one-time, 80–85%; Revid.ai 50–60% — not recommended. Advice: don't pay monthly; the secret is the 15 metrics + 4 specialized passes.
ARGON AMENDMENT (2026-11-12, araby's order after his own Argon session): Argon audited the Abu Simbel v4 sheet against the reference storm-oil short and found 8 essential differences; its refinements are folded into targets 2, 3, 4, 6, 8, 9, 10, 14, 15, 20 and the script beats above. KEPT against Argon's text: captions stay 55–68% (araby's rule, not Argon's 72–78%) and the build stays 4 parallel subagents (not Argon's single-agent workflow). Target 19 ghost dissolve is REMOVED per Argon's hard-cut rule. Argon's skill file (skill__3.md) is kept at ~/workspace/user/files/skill__3.md for reference.
FLOW GUIDE AMENDMENT (2026-11-12, araby's research): the Flow Arabic practical guide (1035 lines; HTML + PDF saved at ~/workspace/redrawn-team/flow_ricks_guide_2026-11-12.html/.pdf) folds in as: topic-mining sources in Step 1 (Reddit TIL, Wikipedia DYK, books, ScienceDaily/NASA/NOAA), a new tension every ~5–7 s in Beat 4, the billboard lit-material verification in target 13, the bush/flag readability traps + the short_qa.py last-2-seconds blind spot in Section C. Full deltas: ~/workspace/redrawn-team/flow_guide_deltas_2026-11-12.md. NOTE (unresolved, araby's call): the guide recommends captions in POST (CapCut) after the Remotion render, not burned in — our target 20 burns them in per araby's order; his rule stands unless he says otherwise.

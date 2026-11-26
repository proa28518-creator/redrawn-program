# Motion API (engine/ease.js track.js clips.js walk.js compose.js facetime.js camera_moves.js)

Pure ES modules, no THREE. Everything is a function of t (seconds, frame n = n / 30): seek anywhere, same Pose, no state,
noise hashed. Units D (head diameter), degrees. Tests: `node lab/motion/test.mjs`; curves: `node lab/motion/plots.mjs`
-> `lab/motion/channels.svg` (+ .png); per-frame dumps: `node lab/motion/scratch.mjs`; through rig.js: `node lab/motion/rigcheck.mjs`.

## The one call
`evalPose(timeline, t, rest) -> Pose` (compose.js). `rest` = the rig's `{ hipY, shoulderR, shoulderL, hipR, hipL, armLen, legLen, headY, ankleY }`
from the rig (body space: origin at the hem, +Y up, +Z facing, +X the character's LEFT). Compiled once per (timeline, rest)
object, cached; ~0.01 ms per frame. `events(timeline, rest, t0, t1)` -> clip events in a window (`impact`, `sparks`, `release`).

## Timeline
```js
{ root: { x, z, ry },                                   // where he stands at t = 0
  base: { 'body.bend': 5, 'armL.hand': [[0, [.2, .1, .3]], [2, [.2, .3, .3]]] },   // constant or [[t, v, ease?], ...]
  clips: [{ name, t0, params, in, out, hold, weight, mask, add }],   // in / out = blend frames; hold = seconds the end pose stays dead still before out; out omitted = HOLD forever
  walk:  [{ t0, path: [[x, z], ...], speed (D/s), gait: 'walk'|'run', cane: 'R', step: 9, stride, bob, lift, arms, lean, cross, crouch, face: deg | [x, z] }],
  face:  [{ t, eyes, brow, mouth }],                    // expression snaps; missing fields carry over
  say:   [{ t0, words: [{ word, start, end }] }],        // word times relative to t0 (seconds, from tools/voice.py)
  blink: { seed, every: [1.1, 1.4], busy: [[a, b]] } | false,
  look:  [{ t, at: [x, y, z] | (t) => [x, y, z] | null }],
  plants: [{ leg: 'R', t0, t1, at: [x, 0, z] }],
  sit_on: { seat: [x, z], t0, face: 0, seatY: .55, path, cam },   // FX1: walk in front of the seat, turn on the camera side, sit back (feet planted)
  until }
```
Layer order: rest -> base -> face (expressions, blinks, talking) -> walk root -> clips in t0 order -> walk legs + bob +
arm swing (only while walking) -> default feet planted under the hips (world, y = ankleY) -> plants -> look (look.at travels between
targets around the head in 5 f fastIn; the rig turns the head to it exactly). Signs = engine/rig.js: body.bend + forward,
body.lean + sideways to his left (+X), twist / head.yaw + toward his left, head.pitch + nose up. Hands `in:'body'` = the hem
frame (they move with bend); clip feet `in:'root'` = the ground frame under him (y = ankleY), walk feet `in:'world'`.
rest.headY may be above the ground (character.js) or above the hem: `hh(rest)` in clips.js handles both.

## Height and place (engine/height.js, 2026-11-04). Tests `node lab/fixes/test.mjs`; lab films `lab/fixes/sink fall deck place shaded`, strips `lab/fixes/strips/`
A timeline can lift a character and move him. All times take `line:N...` in a film. A timeline with none of these keys never reaches this code.
```js
{ root: { x, z, ry, y },                                  // y = the height he STANDS on from the start (a deck). cast: `y`, or at: [x, z, y]
  height: [ { t: 0, y: 6 },                               // first key without `over` = where he is up to then
            { t: 2, y: 1, over: 2.2, ease: 'inOutSine' }, // starts moving on t, arrives at t + over (no `over`: arrives on t, leaving when the last key ended)
            { t: 5, y: 5, over: 1, legs: 'tread' },       // legs: 'float' (default off the floor) 'tread' 'hang' 'climb' 'stand' (a lift: feet ride on it; floor rises too)
            [ 7, 3 ], [ 8, 1, 'lin' ],                    // short form [t, y, ease?]
            { t: 9, fall: 0 },                            // gravity (g 20 D/s^2) down to y 0, knees take the landing. fall: true = down to the floor he was on
            { t: 3, fall: 0, up: .7, to: [2, .4], ry: 80 }, // a jump: crouch `antic` f (5), rises `up` D above the higher of start / end, travels to [x, z] in the air
            { t: 3, fall: 2, land: { dip: .2, hold: 2, frames: 10, bend: 12 } } ],   // land: false = no knee bend. floor: n on any key = the level the blobs lie on + he stands on
  place:  [ { t: 4, at: [60, 1], ry: 70, y: 0, legs: 'stand', floor: 0 } ],          // a SNAP: place + facing + height on that frame (y default 0, at / ry default where he was)
  walk:   [ { t0: 1, path: [[-1, 0], [-.4, 0, 0], [-.36, 0, .6], [4, 0, .6]] } ] }   // a third number on a path point = the ground's height there
```
- `pose.root.y` = the height of his ground (rig.js adds it to the whole chain). Body-space hands, root-space feet, head and everything hung on them follow it by themselves.
  Compose adds it to everything that is world: planted feet, walk feet, cane, look, reach. **`body.hipY` stays relative to the root**: world hip height = `root.y + body.hipY`, head = `root.y + hipY + hh(rest)` (make_film's collar track and listener gaze, film_end's camera floor, focus, the stage's `rootOf` -> `[x, y, z]` do this).
- `pose.floorY` = the level under him (only on a timeline that uses height): blobs and contact shadows lie there, fade out by 3 D above it. `pose.airK` 0..1 = how far off the ground the legs are.
- **Standing or floating?** Off `floor` = legs off the ground. `floor` starts at 0, or at `root.y`, and moves when he stands somewhere: `legs: 'stand'`, a `fall` that lands, a walk on path heights, a `place`. A height key that arrives at `floor` ends standing. So `{ t: 0, y: 6 }` floats, `root: { y: 6 }` stands on a deck.
- **Legs off the ground** (`legPose`, root space, under clips' arms): `float` hanging, knees a little bent, slow flutter 2.8 s, toes down. `tread` knees up, 1.3 s bicycle. `hang` straight, still. `fall` wide, scrambling, reach down 5 f before the landing, on the floor on the landing frame. `climb` feet and hands alternate on rungs .45 D apart (stand him facing the ladder). Blends 6 f (fall 3 f, landing 0 f for feet, 8 f for arms). `sit` / `kneel` clips keep their own legs in the air.
- **Arms off the ground** go under the clips: any arm clip still wins, a body-space prop in a hand is carried along. `walk` while floating moves him, its legs and bob are replaced.
- **Place keys:** the root jumps on that frame, no frame in between. They end running walks, seats and every earlier clip's root and legs (a turn half way can't push him off the new place); arm clips, faces and props in hands carry on. `walkK` is off around the jump (the stage reads speed from the root). A walk / sit / pick_up at the same time starts from the new place. A look held across the key moves with him (same direction from his body); a look key on the key's own frame is in force at once, no swing. `follow`'s lag never averages across the jump (`placeTimes(tl, rest)` -> `camera_moves.follow({ jumps })`); shading reads never cross a move of > 4 D in their .24 s window.
- `events()` also gives `{ t, name: 'land', h }` (D fallen) for sound.
- Plants (`tl.plants`) stay world: give the real height.

Clip rules: key value `'@'` = the channel's value underneath at the clip's start, `{ '@': d }` = that + d. A channel path
ending in `+` is additive. After its `dur` a clip holds its last values (dead still, law 5) until a later clip writes the
channel; `face.*` (except `face.flip`) and the clip's `release` list fall back. A walk takes over root + legs from clips that
ended before it. `mask: ['armR']` keeps only those groups. Use `tl.face` for lasting expressions; face snaps inside clips
last only for the clip.

Clip entry `hold` (seconds, M2): the clip's end pose, face snaps and released channels included, stays dead still that long; then
`out` (frames) blends back to what is underneath (`{ name: 'point', t0: 2, hold: 1.5, out: 6 }`). Not the same as a clip's own
`params.hold` (frames inside the clip, e.g. wave / shrug / sip). M2 lab: `lab/motion2/clipsheet.mjs [out] [clips] [near]` renders a
contact sheet (one row per clip, 6 frames across its dur + 1 held), `walkshots.mjs <tag>` walk strips (engineer + pip, side + 3/4),
`talk.mjs` the viseme sequence of `lab/voice/test/words.json`.

## Agent A (2026-11-04): collar grab, shorter quicker steps
- **`grab_collar` { side: 'R'|'L', target: '<cast id>', reach: 5, release: null, jerk: true }**: this hand goes to the target's collar
  (top of the torso just under the head, on the side facing the grabber, .2 D out of the body axis) in `reach` frames and STAYS on it
  every frame while the target turns, leans, steps or walks. Held until a later clip moves the same arm (compose's armEnd: the arm then
  goes back to what is underneath) or, with `release: N`, let go after N frames (back to hang in 4 f). How: one timeline can't see
  another, so make_film (`collarTracks`) evaluates the target's pose every frame from the clip's start to the film's horizon and passes
  `params._track` = `[[lt, [x, y, z]]]`; the clip's `armX.reach` channel pulls the DRAWN hand onto it (the hand-over mechanism). The
  target gets `collar_jerk` (auto clip: .08 D toward the grabber in 1 f + 4 deg lean, back over 8 f) on the contact frame unless
  `jerk: false`; the track includes the jerk. Stand them about 1-1.2 D apart, root to root: make_film prints the distance and says
  FAR past 1.3 D (the arm stops at 1.25 x armLen and the fist leaves the collar). Without make_film (`_track` missing) the hand only
  rises to the chest. Lab film `lab/br_collar` (strips `lab/br_collar/out/consec*.png`).
- **Walk cadence:** HIS = step 7 f / stride 1.075 legLen (pace u: 8/7/6 f, 1.0-1.15 legLen), run 5 f / 1.2 legLen (fast run 4 f):
  the SAME ground speed as the old 9 f / 1.4 (run 6 f / 1.5) but the trailing leg no longer stretches into a long rubber curve.
  A walking (non-cane) swing foot leaves the back position fast (`lerp(inOutSine, outQuad, .6)`). Explicit `step` / `stride` still win.
- **Run reach (RUN2):** a running leg (hip socket to ankle, as walk.js places them) never exceeds `RUN_REACH` 1.05 x legLen. Run
  footholds land `RUN_BACK` .3 stride short of the walking hold (half that on the second-last), so the planted span is centred under
  the hips; a planted foot past the limit drops the hips (max .12 legLen); a foot in the air is pulled toward the hip along its line
  (the knee folds, the heel kicks up); the swing eases inOutSine (no 2-strides-in-2-frames whip); the last two steps lift half the
  flight early. Measure: `node lab/br_run2/measure.mjs <speed> <dist> [pathJSON] [ryStart]` (worst reach per run).

## ENG8 (overnight 2, 2026-11-04, blind5 stuck points 1, 2, 5 + Fable review 4 items 2, 7). Tests `node lab/eng8/test.mjs`; lab film `lab/eng8/blind5` (strips `lab/eng8/strip_*.png`)
- **Glasses on / lowered / off / in a hand** (spec glasses only, WARDROBE_API.md): pose channel `glasses: 'on'|'lowered'|'off'|'hand:R'|'hand:L'`
  (missing = 'on') + `glassesLow` 0..1 (how far down the nose; 'lowered' = 1). Snap it with a face key `{ t, glasses: 'lowered' }` (a later
  face key beats a clip) or a base track, or play a clip (the hand goes to the glasses' outer edge on its own side as the camera sees it,
  in front of the face: arm channels `armX.specs` 0..1 + `armX.specsDy` D, character.js):
  - **`glasses_lower`** `{ side='R', reach=3, drop=3, back=4, up=false, dy=.2 }`: hand to the glasses 3 f, slides them down 3 f (they follow
    the hand on ones, 4 drawn steps), lets go, back 4 f; ends `lowered` (held). `up: true` pushes lowered glasses back up.
  - **`glasses_off`** `{ side='R', reach=3, down=5, to='chest'|'hang'|[x,y,z] }`: hand to the glasses 3 f, they leave the face THAT frame and
    sit in the hand (drawn front-on, both lenses, beside the fist, never over an eye), down to `to` (in front of the chest) in 5 f, held
    there (open-ended, a later clip on that hand ends the hold; the glasses stay `hand:X`).
  - **`glasses_on`** `{ side='R', up=4, back=4 }`: the holding hand brings them to the face 4 f, on at contact, hand back 4 f.
- **Clip `shake`** `{ side='R'|'L'|'both', count=4, amp=.1, sway=.35, twist=1.5 }`: `count` oscillations at 1 f up / 1 f down (decaying 12 %
  each), ADDITIVE (`armX.hand+`), so a held prop shakes wherever the hand already holds it (raise_prop / carry / hand-over pose are not
  ended), body twist +-1.5; ends exactly where it started. Two-handed = `both`.
- **Clip `sign`** `{ side='R' (the writing hand), boardSide (the other), board: prop id, pen: prop id, frames=8, reach=4, look=-12, rot, penRot }`:
  the board hand brings the board/parcel in front of the chest (4 f, stays there after), the writing hand comes to it, scribbles `frames` f
  on ones (small zig-zag drifting along a line), lifts off 3 f, goes back 4 f (released); head down -12 deg + eyes `half` while writing.
  `pen` = a `pen` prop (engine/props/pen.js) riding hand:<side>. Use the NEAR hand to write (the far hand hides behind the board).
- **Timeline `armEnds: [{ side, t, since, out }]`** (make_film fills it from every hand-over: giver + taker, `t` = hand-over t + hold,
  `since` = hand-over t, `out` = back frames): each clip that started before `since` and still writes that arm fades its armX.* channels
  out over `out` frames from `t` (point / offer / reach / carry of the prop that left). Clips from `since` on (the taker's `carry` of the new
  prop), seats and `keep: true` are left alone; `armHoldEnd: false` switches it off.
- **Runs keep the head level** (review 4 item 7): run bob .12 -> .06 legLen (walk.js) and, while running, `pose.running = true` lets
  character.js stretch the noodle legs to 1.32 x legLen before dropping the hips (was 1.13: a kid's 1.5-legLen stride dipped the hips
  ~.25 D on every contact, the head bobbed and tilted). Lab `lab/eng8/run` (`run_before.png` / `run_after.png`).

## ENG7 (overnight 2, 2026-11-04, blind4 stuck points 1, 2, 5 + the timing audit). Tests `node lab/eng7/test.mjs`; lab film `lab/eng7/blind4`
- **Clip `eat` / `bite`** `{ side='R'|'L', prop, up=5, hold=3, down=5, chew=1, to='chest'|'forward'|[x,y,z], open='v_A', nod=3, rot }`
  (`eatTimes(params)` -> `{ open, up, bite, lower, end, chewEnd, dur }`, defaults 0 / 5 / 6 / 9 / 14 / 24 f): the hand travels FROM -> the
  mouth on a quadratic arc (bulge .14 D out + forward, fastIn, `up` f), `armX.drink` rides it 0 -> 1 (character.js puts the hand IN FRONT of
  the drawn mouth as the camera sees it, either arm), `armX.over` on, `armX.clear` / `temple` forced 0; the mouth opens (`open`) >= 6 f
  before the bite (the face limiter holds a mouth 6 f outside speech) and SNAPS to `v_M` on the bite frame (`max(up + 1, 6)`), event
  `bite`; head pitch +1 meeting the food, -`nod` snap on the bite, home by lower + 4; the hand stays `hold` f, back down to `to` on an arc
  (`down` f), held; chewing v_E / v_M 6 f each, `chew` times. `prop` rides hand:<side> + grip. make_film adds the prop's bitten opt key.
- **Clips `pick_up` / `put_down`** `{ prop, at: [x,y,z] WORLD spot, side='R', reach=5, grab|release=2, lift|back=5, to='chest' | after='hang',
  bend=auto, rot, worldRot }`: `armX.reach = { at: spot, w }` (character.js pulls the drawn hand onto the world point by w) goes 0 -> 1 over
  `reach` f (fastIn), holds 1 for `grab` f, 1 -> 0 while the hand channel goes FROM -> `to` (pick_up) / -> `after` (put_down) over `lift` f.
  The CONTACT frame = `reach`: `props.<id>` switches `{ in:'world', at: spot, rot: worldRot }` <-> `{ in:'hand:X', at:[0,0,0], rot }` (pick_up
  sets grip there, put_down clears it; events `grab` / `put`). `body.bend+` 0 -> B ('careful') and back over lift + 4 f (body speed; a 5 f
  fastIn bend jerked the other hand's prop 57 px). B = `reachBend(rest, spot, root, side)`: the smallest bend that brings the shoulder
  within .85 armLen of the spot (compose passes `_root` = the root at the clip's start); unreachable at 40 deg -> `COMPOSE WARNING`.
  rot / worldRot: give one, the other = it +- the root's yaw (exact for yaw-only turns). No spot + a prop = a clear error; no spot and no
  prop = a bare reach to hip height in front (clip sheets).
- **Held arm clips end (compose `armEnd`):** an OPEN-ENDED clip (no `out`, not a seat, not `_auto`, not `keep`) that writes `armX.*` stops
  writing that arm from the first LATER clip that writes `armX.hand` / `armX.reach` (non-additive), at that clip's t0 + its `in` (still on
  AT its t0, so the later clip's '@' is the held pose). `KEEP = carry, akimbo` (lasting states, come back after); entry `keep: true|false`
  overrides; timeline `armHoldEnd: false` = the old rule. Every film compared frame by frame: `node lab/eng7/same.mjs` (diffs only after a
  later arm clip finished: last_loaf mara / walter armL.bend, coffee_break boss, blind3 nora, blind4 rosa; listed in FILM_API ENG7).
- **Timing audit (lab/timing/TIMING.md):** `akimbo` default 7 -> 4 f; `react` (recoil / lean_in / slump) body bend now fastIn over 8 f from
  +1 with a 6 % overshoot at +9, settled +12 (~64 % by +4, ~75 % by +5, decaying tail; was 100 % by +5); timing.mjs body at4/at5 now
  mara .73/.82 (was .92/1.0), pip .63/.76, ines .68/.79, nora .70/.80, okafor .70/.80. Face limiter: in the 8 f after a listened line ends
  (outside his own lines) an eyes / brow change needs only 2 f of the old state (the listener's answer is no longer held back 8 f).
  Not changed: `raise_prop` frames 6 (mo2 tests pin it), `sip` 18 f (his cup f828-845), point / wave / shrug / temple / brace / talk_hands
  (already 1-4 f); the remaining slow gestures in the audit are authored `frames` / `out` / sips.

## ENG5 face rhythm limiter (overnight 2, 2026-11-04, FABLE_REVIEW3 items 3 + 8). Tests `node lab/eng5/test.mjs`
The COMBINED face (expression keys + talking + listener answers + phrase eyes + stress brows + react / clip face keys + blinks) is
re-timed once per compiled timeline, forward over the frame grid (`compose.js faceLimiter`), so it is deterministic and pure in t:
- **eyes**: every new eye state holds >= 8 f; a change that comes early waits until the hold is over (and is dropped if the raw face
  has moved on by then). Blinks (2 f) and a `half` squint of <= 2 f leading into another state (a clip's anticipation) pass as
  in-betweens and don't reset the clock.
- **arc** (closed-eye smile) inside DIALOG (his own line, or another speaker's line he listens to, `tl.listen` + 9 f) is an ACCENT:
  `arc` f (8) then `open`, until the raw eyes leave arc. Face key `{ t, eyes: 'arc', hold: true }` keeps it until the next eyes key.
  Outside dialog an arc key is a state and holds as authored.
- **brows**: >= 8 f holds; during his own line LOCKED to the value at the line start, except ONE raise on the line's main stressed word
  (the longest stress window, `facetime.say().stress`) and the author's own brow keys inside the line.
- **mouth**: visemes pass untouched while speaking; outside speech an expression mouth holds >= 6 f.
- Timeline keys: `faceLimit: false` (off), `faceLimit: { eyes: 8, brow: 8, mouth: 6, arc: 8 }` (frames). make_film `--no-facelimit` =
  the raw face for every character (before/after strips). Tools: `lab/eng5/trace.mjs <resolved.json> <who> [f0 f1]` prints the runs
  raw vs limited; `lab/eng5/strips.py` head-crop strips before/after (`lab/eng5/strip_*.png`).

## FX1 (overnight 2, 2026-11-04, blind3 stuck points 2-5). Tests `node lab/fx1/test.mjs`; lab films `lab/fx1/sit`, `lab/fx1/wave`
- **ENG10 (2026-11-04, blind6 stuck points 2 + 4):** (a) `sit_on` lands the HIPS ON `seat` in every mode. The root where the sit starts
  (after the walk + turn) is measured; when it is the front point (walk mode, or `from: 'here'` standing there) `sit_back` moves `back` D
  against the facing as before (feet planted, bit-identical); otherwise (`from: 'here'` anywhere else, e.g. standing ON the seat mark: the
  hips used to land .59 D behind the seat) `sit_back` gets `shift: [dx, dz]` = seat - root (world) and the root slides there over f4-14
  (careful) while the feet end `back` D in front of the hips (they slide with it). `c.sitOns[i]` records `start` + `shift`. (b) pick_up /
  put_down on a seat: compose passes `_root.hipY` = the seat's hem height (`sit` / `sit_down` / `sit_back` `seat`, kneel .5 legLen) while a
  seat clip holds (not after its stand_up ended or a walk started); `reachBend` measures the shoulder from there (a table spot .55 D ahead
  needs 0 deg seated; it asked 32 deg + warned from the standing hips), the warning then says "from where he sits". Standing reach unchanged.
  Tests `node lab/eng10/test.mjs`; every film's poses old vs new: `node lab/eng10/same.mjs` (only blind6/bea differs: hips .003 D onto
  the seat, the seated pick_up bend 40 -> the real one).
- **`sit_on`** (timeline key, one entry or a list; also `{ sit_on: {...} }` entries): `{ seat: [x, z] | 'mark', t0, face: deg = 0,
  seatY = .55, from: 'walk' | 'here', path: [[x, z], ...] via points, speed, gait, step, cam: [x, z] | [{ t0, t1, at: [x, z] }] }`.
  `seat` = the hip point on the seat (make_film turns a set mark name like `'sit'` into it and takes the set's `seatY`). Expands to a walk
  to the point `back` D in front of the seat (back = how far seated feet sit in front of the hips, ~.59 D at seat .55), a `turn` to
  `face` that swings through the CAMERA side (`cam`, filled by make_film from the shot covering the turn: park pos / push mid-way;
  follow / orbit shots give none -> the shortest turn; the long way is taken when it keeps the face to the camera longer), then the new
  clip **`sit_back`** 2 f later: the hips go back and down onto the seat while the feet stay PLANTED in the world (root slides back,
  root-space feet forward by the same eased amount: `feet_slide` 0). Its root move is permanent: a later `stand_up` leaves him at the
  seat, a later walk starts from it. The approach direction is yours: a `path` that arrives from the side keeps the face on camera
  (arriving from behind the seat line shows the back for the walk itself). `sit_back` alone: `{ name: 'sit_back', params: { seat, ry, back } }`.
- **Raised hands stay off the face:** `wave` and `point` write `armX.clear` (0..1, rides with the hand move). character.js then moves a
  hand that would draw over the head disc AS THE CAMERA SEES IT out beside the outline on its own side (continuous: the push is how far
  it is inside, faded by height (chest-level hands are left alone) and depth (a hand behind the head is hidden by it)). The near-arm wave
  of a 3/4 character no longer crosses the face; no need to switch arms. Any clip can write `armX.clear: 1` for the same.
- **Brimmed hats nod less:** a hat with a brim (`hickory ballcap flatcap tophat strawhat officer bowler`) limits a `look` that points
  well below eye level to 18 deg of head pitch down (spec `hat.pitchMin` = another limit, `null` = none); the target keeps its yaw
  and the pupils (`look.gaze`) still get the real target. Looking at crumbs on the ground no longer turns a flat cap into a grey disc.
  Keyed `head.pitch` (clips) is not limited.
- **Times:** every time key in a film takes `line:N...` (FILM_API.md); a bad one fails with the key path.

## MO2 (overnight 2, 2026-11-04, FABLE_REVIEW2 items 4 5 8 9 11 12 13 14). Strips `lab/mo2/<scene>_after.png` (12 consecutive frames,
LEFT/far = before, RIGHT/near = after), scenes `lab/mo2/<scene>/film.json`, `node lab/mo2/render.mjs [tag] [scene]`, tests
`node lab/mo2/test.mjs`, every film's timelines through compose `node lab/mo2/filmcheck.mjs`, talk probe `node lab/mo2/talkprobe.mjs <film> <word>`.
New keys (all additive; old films get the defaults below):
- **Face key `react`** (`tl.face[i].react`): `'recoil'|'lean_in'|'slump'|'jolt'`, or `{ kind, deg, hold, back }`, or `false`. Unset = the
  default of the key's NEW eyes (`wide` recoil, `wince` jolt, `angry` lean_in, `sad` slump) or mouth (`o`/`wide` recoil, `grid` jolt).
  His f420-431: eyes snap on the key frame, head leads on +1 (pitch), body from +2, ~18 deg (recoil) by +6 fastIn with a 1-2 deg
  overshoot, settled +9, dead still until the next key that changes the eyes (max 60 f, else 40 f), home in 10 f. Seated characters
  react from the seat (bend only). Not added for keys at t = 0 (opening state) or when an authored body clip (shock_pop, shock_jump,
  wince, lean_*, brace, react, stand_up, sit_down) starts within 3 f of the key. Compiled into auto `react` clips (`spec._auto`).
- **Clip `react`** `{ kind='recoil', deg, hold=40 (frames; Infinity = stays), back=10, eyes, mouth }`: the same body move on its own
  (writes `body.bend+`, `head.pitch+`, + `head.roll+` / `body.squash+` for slump). Tables: `REACT`, `REACT_OF` (clips.js).
- **Gaze** (`look` keys, `look_at` clips): the pupils snap to the target on the key's frame (`pose.look.gaze` = the target; character.js
  draws `look_l`/`look_r` when the target is > ~13 deg to one side of the head AS THE CAMERA SEES IT, flip-aware, only over neutral
  eyes `open`/`smug`), the head starts one frame later (was: on the key frame). The pupils stay on the target `gazeHold` s (key, else
  timeline `gazeHold`, else 2 s), then centre (snap); `gaze: 'hold'` = as long as the look lasts, `gaze: false` = never.
- **Arrival settle** (walk `settle`, default on): the last step arrives at .6 of the step still moving (.67 cruise speed), the momentum
  carries the root .03 legLen (run .06) past the mark and pitches the torso forward 3 deg (run 6; `settleDeg`) over 2 f, back by +5,
  exact 0 from +6 (dead still), the old hip dip after. `settle: false` = the old ease-to-zero stop.
- **Walk defaults:** stride without `speed` 1.0 -> .85 legLen (his steps ~ one head wide), lean 3 -> 5 deg, bob/lift floor for short
  strides .45 -> .7 (the body carries weight). With `speed` the stride is still speed x step time.
- **Cane** (walk `cane: 'R'|'L'`, new `caneProp` = the prop id, default `'cane'`): while walking, compose writes
  `props.<caneProp> = { in: 'world', at, tip, caneHand }`; character.js puts its top on the DRAWN hand and aims it (rot) at the
  planted tip, so the tip stays put between steps (walk.js: the hand now rides with the body beside the hip, caneLen from the tip).
  A clip that writes `props.<caneProp>` (cane_twirl) wins while it runs. `caneProp: 'none'` = the old hanging cane.
- **Clip `raise_prop`** (alias `open_umbrella` = `to:'up'`) `{ side='R', to='up'|'chest'|'forward'|'mouth'|'side'|[x,y,z], frames=6,
  antic=2, bulge=.25, prop, rotFrom, rot }`: the hand dips .08 D for `antic` f, then travels `frames` f fastIn on a curve bulging out
  sideways + forward, 1 f overshoot (4 %), held. With `prop` the prop rides hand:<side> and turns `rotFrom` -> `rot` with the same ease.
  Recipe (umbrella hanging tip-down, raised and opened): prop `{ id:'u', kind:'umbrella', in:'hand:R', rot:[180,0,0], open:0,
  keys:[{ t: T + (antic + frames - 2)/30, open: 1, ease: .2 }] }` + clip `{ clip:'raise_prop', t0: T, params:{ prop:'u', rotFrom:[180,0,0],
  rot:[0,0,0] } }`. Any prop move between two places: raise_prop with `to: [x,y,z]` (body space), never a prop key that teleports it.
- **Drinking** (`sip`): from f13 to hold + 5 f the mouth is `v_M` (shut, under the cup; beats talking), and `armR.drink` 0..1 rides
  the hand: character.js moves the drinking hand IN FRONT of the drawn mouth as the camera sees it, so the cup covers the mouth
  and the hand dot sits on the mug.
- **Talking** (`say`): inside speech, once 6+ f passed since the last closed shape (v_rest v_M smirk v_F), the next short small-lens
  key becomes closed lips v_M: long vowels go wide / small / closed / wide ("That's... salt." was one oval held 9 f at film size).
- **Clip `at` as a number** = seconds (= `t0`); make_film only turns `'line:...'` strings into t0. Any other `at` on a clip entry
  without t0 prints `COMPOSE WARNING` once and starts at 0.

## ease.js
`E` (easings.net names), `springStep(x, freq, damp)`, `F(n)`, `clamp lerp seg hash`, and his curves: `fastIn(k, a=2)` (64 %
at frame 4 of 10, 73 % at 5, no overshoot), `snap`, `careful(k)` (cup: accel 4/18, cruise 6/18, decel 8/18), `gesture`
(outQuad), `strike` (inQuad, stops dead), `windup`, `whipIn`, `whipOut`, `twoHump(k, dwellAt)` (orbit with front dwell).
`easeFn(name|fn)`; unknown names fall back to `fastIn`.

## track.js
`K([[t, v, ease?], ...], ease='fastIn') -> { at(t, from) }`: numbers / arrays interpolate (ease on a key = ease INTO it);
strings, bools, null, objects step. Before the first key: first value; after the last: last value. Equal neighbours hold
bit-exact. `S(keys)` step track (gives what is underneath before its first key). `C(v)`, `mix`, `blend(u, v, w)`,
`add(u, v, w)`, `layer(base, over, { w, additive })`, `FROM`.

## clips.js (`CLIPS[name](rest, params)` -> `{ dur, ch, release, events }`)
| clip | params | timing (MOTION_BIBLE) |
|---|---|---|
| hold / idle | frames | writes nothing: exact zero motion (s9) |
| stop | deg=3 | momentum catch after a walk, 8 f |
| turn | by=90 | root.ry 10 f fastIn, feet step it (R f0-6, L f4-10) |
| kneel / sit | bend=30, seat (D, hem height), frames=0 | appear already done (s3); frames > 0 animates (careful); seated feet from the seat height (low seat = feet further out, high seat dangles) |
| sit_down | seat (D) | not in his video: lean 4 f, hips down 14 f careful, feet step to the seated feet |
| stand_up | from='kneel'/'sit', near='R' | +14 deg down 7 f, hold 2, slow 10, fast 6, settle 4; hands f19-23, f21-28 (s3) |
| lean_over / lean_back | deg, eyes / to | antic 3 f, face f2, body 10 f fastIn / 9 f + -.5 overshoot (s3) |
| hop_bounce | height=.36, count=2 | his per-frame head shape f1345-1366, feet planted, legs stretch (s3) |
| point | side, dir | 4 f to level, held (s4) |
| wave | side, eyes, hold=8 (f), down=true | brim 3, hold 8, wave 4, down 4; eyes bracket it (s4). Hand beside the cap, outside the head outline, elbow out + down |
| akimbo | side='R'/'L'/'both', frames=4 | 4 f fastIn (ENG7, was 7), then holds through everything (s4) |
| eat / bite | side, prop, up=5, hold=3, down=5, chew=1 | arc to the mouth 5 f, bite snap f6 (v_M), back to the chest 5 f, chews (ENG7) |
| shake | side ('both'), count=4, amp=.1 | additive 1 f up / 1 f down x count on the held prop, body twist (ENG8) |
| sign | side, board, pen, frames=8 | board to the chest 4 f, pen hand scribbles 8 f on ones, lift 3, back 4; head down (ENG8) |
| glasses_lower / glasses_off / glasses_on | side, reach=3 | hand to the glasses 3 f; down the nose 3 f / into the hand + to the chest 5 f / back on (ENG8) |
| pick_up / put_down | prop, at (world), side, reach=5, grab/release=2, lift/back=5 | hand onto the world spot, prop changes owner on the contact frame, lift / let go (ENG7) |
| shrug | hold=8 | one-frame snap: hands out LOW and small (hip height, palms-up feel, elbows down), head up; back in 4 (s4) |
| hand_to_temple | side, hold=24, down | up 3, parks while the face acts (s4); hand beside the head, elbow down (no loop over it) |
| brace | side='L', eyes | face f0, hand up 3 f from f2 (s4/s6) |
| talk_hands | dur (s), side, seed | a chest pose every 1-1.6 s, 3 f each, parks between |
| carry | prop, side='both' | hands to the chest 4 f, grip + props.<id> in hand |
| sledge_swing = swing = use_prop | prop, eyes, mouth | handle table f755-784; body back 7 / forward 4; events impact f13, sparks f15 (s5) |
| sip | hold=20, eyes, prop | 18 f careful up, hold, 18 f down; eyes relax on arrival (s5); prop = the cup in hand:R (+ grip) |
| flick_toss | side, prop, hold=12 | chest -> full arm 3 f, release f4, arm holds (s5) |
| shock_pop | body, eyes='wide' | eyes snap f0, optional body f1 (s6) |
| shock_jump | height=.21, arms | +.21 D over 4 f (9 16 21 11 px/f), arms up 2 f, freeze (s6) |
| wince | mouth | pre-wince 1 f, snap, torso shift 1 f later (s6) |
| head_turn | yaw=40 | blink 2, smear 1 (face.on false), overshoot 1, settle; flip changes side (s7) |
| look_at | at | sets look.at; look.at moves to it in 5 f fastIn, tracks moving targets |
| saw_stroke | side, count=2, reach | push 7 accel, turn 2, pull 6; lean +8 in phase, hand up .2 on the push (s3) |
| cap_lift / hat_launch | dir | wind table f96-102 (hat.tilt / hat.lift, head space) / tip, lift 2, leaves sideways + spin (s5) |
| cane_twirl | prop, tilt | 2 turns in 11 f, 75 deg past rest, back in 4; props.<id>.rot = [tilt, 0, spin] (s5) |
| release_tool | prop, side | detached next frame: props.<id> = { in: 'release', t, mode: 'drop', v0, g } (s5) |
`at.hang/hip/chest/forward/side/up/brim/temple/mouth/face/foot(rest, side)` give the body-space targets the clips use.

## walk.js
**MO3 (overnight 2, 2026-11-04, the lab/timing audit: our steps .56-1.0 D at 11-12 f vs his 1.7 D at 9 f, 2-4x slow; results
`lab/mo3/RESULT.md`, strip `lab/mo3/walk_vs_his.png` = `node lab/mo3/walkstrip.mjs`). HIS cadence is the default; it overrides the
R1 / MO2 numbers below where they differ:**
- **Step 9 f, stride 1.25-1.5 legLen** (adult legLen 1.2 -> 1.5-1.8 D, his ~4 R = 1.7 D; kids / tall scale by legLen), ground speed
  ~.15-.2 D/f constant mid-walk. **Bob .3 legLen** (.36 D adult, his .7-1.1 R) as a sawtooth in FRAMES: drop 2.5 f starting 1.5 f
  before contact, rise the rest (6 f at 9) with decaying speed. Lift .11 legLen, arm swing .13 D. The deep dip is what lets the wide
  stride reach the ground; legs still cross mid-step, planted feet bit-exact.
- **`speed` on a normal walk / run is a PACE**, read on the R1 authoring scale every film so far used (`paceOf`: ~1.3 D/s stroll,
  2.6 normal, 3.5+ brisk, x legLen / 1.2): pace -> step 10 (stroll) / 9 / 8 (brisk) f and stride 1.25 -> 1.5 legLen. Old films keep
  their keys and now walk at his speed. **The literal R1 cadence** (speed = real ground D/s, 12 f shuffle .. 8 f brisk, stride =
  speed x step time) stays for the old-man gaits: `cane`, `slow: true`, or `speedExact: true` (Walter: 12 f x .6 D, unchanged).
  Explicit `step` / `stride` / `bob` / `lift` / `arms` always win.
- **Run**: 6 f steps (5 above 6.5 legLen/s pace), stride 1.5 legLen, bob .12 legLen, drop 1.6 f then rise (sawtooth).
- `cadence()` also returns `{ pace, literal }`; `HIS` (the numbers) and `paceOf(v, legLen)` are exported.
`walk(points, rest, { speed, gait, step, stride, lift, bob, arms, lean, cross, crouch, flight, cane, caneLen=1.15, settle=true, face })`
-> `{ dur, walkDur, steps, S, stepF, stepT, gait, at(tl), end }`. `cadence(rest, opts)` -> `{ gait, run, stepF, stride }` (exported).
**R1 (agent R, 2026-11-04, Fable review problems 1 + 15 "walks are glides"; strips `lab/walk/c_*.png`, scenes `lab/walk/*.json`):**
- **Author walks by `speed` (D/s).** The step time follows it (walk: 1.5 legLen/s -> 12 f, 3.5 legLen/s -> 8 f; run 6 f, 5 f above
  6.5 legLen/s) and stride = speed x step time: a slow old man takes SHORT steps on a slower beat (Walter 1.6 D/s = 12 f x .67 D),
  never a glide. Without `speed`: `step` (9) + `stride` (walk 1.0 legLen, run .95 legLen) as before. A short-stride walk bobs and
  lifts less (x stride/legLen, min .45): shuffle, not bounce.
- **Gait run** (`gait:'run'`, or speed > 4.6 legLen/s, or `step` <= 6 without a gait): swing starts `flight` (.35) of a step early ->
  both feet off the ground ~2 f per step, high heel kick (lift .35 legLen, rises in the first frame), bob .1 legLen, crouch .03 legLen,
  arms .22 D pumping, `bend` 12 deg lean, footholds nearly uncrossed (cross .3). No flight on the first step or the last two.
- Defaults walk: lift .1 legLen, bob .2 legLen (MOTION_BIBLE .7-1.1 R; M2's .14 read as no bob at film size), arms .09 D, lean 3 deg.
- **Bob** is a sawtooth phased on contact: drop starts 1/5 of a step before each foot lands, lowest 2/15 after, rises the remaining
  6/9 with decaying speed. **Arms** swing opposite the legs with their extremes on contact (`armDZ`).
- **Start:** the first foot is off the ground by frame 2. **Stop:** both feet planted side by side, hips settle (1/3 bob, 3 f down,
  6 f up), then dead still (`dur` includes the 9 f settle; `settle:false` drops it). End-turn steps lift crisply and land straight down.
- **Cane** (`cane:'R'|'L'`): the tip rides the OPPOSITE leg's footholds (a bit outside and .22 legLen ahead), swings and plants with
  that foot, never slides while planted. `at()` returns `cane: { side, tip, hand, planted }` and `armR|armL: { hand, in:'world' }` (the
  hand on the cane top, caneLen above the tip).
- **ENG6 (2026-11-04): a cane walk starts from the stance.** On the walk's first frame the cane is where he stood with it: tip from
  the standing heading (`ryStart`, compose passes the root's ry), hand straight above it (= what caneHold keeps before / between
  walks). The hand's hold point turns with the body's REAL heading (ryStart blended into the path's over the first 10 f, the same
  blend compose applies to the root), and the cane leans from upright into the walking lean over the first step and back upright over
  the last (the stop's hand is above the tip), always caneLen from the tip. Before: a walk heading off at 90-135 deg from his facing
  (a second walk: last_loaf f597-601) moved the cane hand .39-.58 D on its first frame and again ~.1 D into the stop (PROP GUARD
  teleports 105 px f72, 43 px f132). `caneStance: false` on the walk = the old cane (before/after strips only). Lab + strips:
  `lab/eng6/cane*/`, `lab/eng6/strip_start_70-77.png`, `strip_f131.png`; test `node lab/eng6/test.mjs`.
- **Needs compose.js (agent Q) to show:** `a.bend` (add to `pose.body.bend`), `a.armOff.{R,L}` (body-space offset added to the hand
  while running: pumping elbows), `a.armR|armL` (world hand target for the cane; skip armDZ on that arm). Until then a run has no
  lean and the cane hangs from the hand.
M2 (2026-11-04, against his walkers f1022-1080, sheets `lab/motion2/walk_a3_*.png`): mid-walk footholds land past the centre line
(`cross` 1 = on it, 1.15 = 15 % past) so the noodles cross at mid-step; the first and two last holds stay under the hips. Legs get
`bend` [-+.15, 0, 1] (knees forward, a little out) and `toe` (down leaving, up a touch landing) through compose. Stride 1.35 legLen
made a straight inverted V; bob .38 D bowed the legs into curves at the dip (films used .16) -> default .14 legLen (.16 D on the
engineer). His measured bob is bigger (.7-1.1 R); getting it without bowed legs needs the rig's legSlack lower (agent F).
Catmull-Rom path, arc length; cadence constant, phase p = tl / step; root accelerates in step 0, constant speed, stops in the
last step; foothold k at min((k+1) S, L), R on even steps: a planted foot is bit-identical across its plant. Bob: drop 3 f,
rise 6 f. `face` turns him at the end in 10 f, the feet step it. `pathOf`, `footUnder(x, z, ry, hip)` exported. In compose a
walk starts where he stands (the current root is prepended to the path) and blends his heading into the path in 10 f (for a big change, author a `turn` first).

## facetime.js
**MO3 (2026-11-04, the lab/timing audit; overrides the numbers below where they differ):**
- **Blinks** 2 f (1 f ~7 %, 3 f ~7 %, never 4) and never closer than `minGap` 7 OPEN frames to another blink (his never are):
  change blinks (law 10) are placed first, a second one inside 7 f of the last is dropped (the earlier blink covers both); auto
  blinks only where they keep the gap; busy default gap 10-16 f start to start. (Clip blinks such as head_turn's are written by
  clips.js / compose and not spaced by this.)
- **Talking at his rate** (a change every ~2.3 f): a final pass inside speech splits any hold of 4 f+ into 2-3 f pieces with a
  partner shape, except the stressed vowel (v_A / v_O / o inside a stress window: up to `stressHold` 5 f, his 4-6); then about
  `flick` (.5) of the 3-f open holds end in a 1-f partner flick (hashed on the frame, pure). Pauses stay closed (v_rest), lead 2 f.
  Over the five demo films: 2.86 -> 2.45 f per change incl. long in-line pauses (`node lab/mo3/sayprobe.mjs`). `say(.., { rate })`
  >= 2.6 switches the pass off (the M2 rhythm). Min hold is now 1 f (occasional), not 2.
`blinks({ seed, every:[min,max] s, frames:2, until, changes, speaking, busy })` -> [[t0, t1, kind]]: calm 33-42 f, busy 8-16,
one 2 f blink right before every expression change (law 10), none while speaking. `say(words, { lead:2, minHold:2, rate:2.3,
pause:.2, offset })` -> `{ keys, spans, mouth, speaking(t) }`: spelling -> sounds -> v_A v_E v_O v_M v_F v_L, stressed (first)
vowel weighted, long holds alternate with a partner shape, gaps of 3 f+ close to v_rest. M2 rules (2026-11-04; print a line with
`node lab/motion2/talk.mjs`): his talking shows NO tongue, so v_L only for a 'th' held 3 f+ (rare); l t d n s z k g x = small lens
v_E; m b p = v_M (ranked with vowels when a word must drop shapes); f v ph = v_F; sh ch j w wh qu oo ou ow, long o/u = v_O; short o
(not, boss) and long i (ride, I, fine, igh) = v_A; short u = v_E; h and r after a vowel silent; silent final e lengthens the vowel
before it (magic e); digits are spoken (`spoken('3.5')` = three point five). After merging across words no hold inside speech
passes 5 f on A/O or 3 f on the rest (then the partner shape 2 f). Test words: 1 swap per 2.4-2.9 f (his 2.3), holds mostly 2-3. `expressions(list)`, `faceTracks({ expr, say,
blink, until })` -> step tracks `eyes brow mouth` (talking overrides the mouth only while speaking).

## camera_moves.js (each returns `shot(t) -> { pos, target, fov }`)
`park(pos, target, fov=26)`, `push({ from, to, t0, t1, ease='outCubic' | 'whipIn' | 'whipOut' })`, `pushIn(shot, { factor })`,
`orbit(center | fn, { az0=-44, az1=55, el=17.5, dist, t0, t1, facing })` (two humps, dwell at the front), `follow(subjectFn,
{ offset, lag, lookOffset })` (box average over 2 lag, pure), `cut([{ t, shot, dissolve }])` (dissolve -> `mix` + `prev`),
`autoPark(shot, [[t0, t1]])` (law 9: camera time stops during big body actions), `frameInfo(s)` (+ az, el, dist).

## Example: walks in, stops, waves, says a sentence, sits
```js
import { evalPose } from './engine/compose.js';
const tl = {
  root: { x: -4, z: 0, ry: 90 },
  walk: [{ t0: 0, path: [[0, 0]], face: 180 }],                       // walk to the origin, turn to face -Z (the camera)
  clips: [{ name: 'stop', t0: 1.6 },
          { name: 'wave', t0: 2.2, params: { eyes: 'arc' } },
          { name: 'talk_hands', t0: 3, params: { dur: 2 } },
          { name: 'sit_down', t0: 5.4 }],
  face: [{ t: 2.2, eyes: 'arc', mouth: 'smile' }, { t: 3, eyes: 'open' }],
  say: [{ t0: 3, words: [{ word: 'see', start: 0, end: .25 }, { word: 'even', start: .3, end: .6 }, { word: 'gaps', start: .85, end: 1.3 }] }],
  blink: { seed: 3 }, look: [{ t: 4, at: [0, 1.5, -5] }],
};
for (let n = 0; n < 200; n++) character.update(evalPose(tl, n / 30, rig.rest), camera);
```

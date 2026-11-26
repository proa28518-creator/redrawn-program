# Faces as data (engine/faceset.js + specs/faces/kit.json)

No sprites, no textures: every face is curves (face.js strokes, domes, ellipses, grid) composed from three parts that snap.
`pose.face = { eyes, brow, mouth, flip, on }` (CONTRACT). Names snap on the frame they change (0 in-betweens). Never tween two drawings.
Defaults: eyes `open`, brow `on`, mouth `rest`. Unknown names fall back (ALIAS table, then the default) and log once.

## Names and what they act
| part | name | acts | source |
|---|---|---|---|
| eyes | open | neutral, listening: solid ovals .19 x .22 R | new (STYLE_BIBLE) |
| | smug | his default: flat lid, egg under it. Cool, sure of himself, bored | his f0-91 median |
| | half | 1-frame in-between of a blink or a surprise (bar + small egg below) | his f17, f92 |
| | blink | 2 frames, every 33-42 f calm, 8-16 busy, never while speaking | his median |
| | arc | ^ ^ happy, laughing, pleased with himself | his f18-22 |
| | wide | shock pop: rings + centre dot, brows pushed up (1-frame snap) | his rings (new drawing) |
| | wince | squeezed slits: pain, effort, cringe | his f93-101 |
| | angry | lid slanting down to the nose: scowl, threat, stubborn | new (Boss scowl) |
| | sad | lid slanting up to the nose: worried, sorry, pleading | new |
| | look_l / look_r | side-eye: egg slid under the lid to -u / +u of the drawing (flip mirrors it) | new |
| brow | on | his lens brow (both sides) | his median |
| | off | no brow (squint, back-lit, "blank") | |
| | up | raised + arched: surprise, question, "oh really" | new |
| | down | low and heavy on the lid: serious, deadpan | new |
| | knit | pinched in: anger, pain, concentration (pairs with angry / wince) | his f93-101 |
| mouth | rest | small closed lens: neutral | new |
| | smile / frown | U / upside-down U | new |
| | smirk | his default: one-sided, sly | his f21-91 |
| | D / Dtongue | open talking D, tongue variant = cheeky | his f0-20 |
| | crescent | toothy grin, 2-4 teeth: delight, scheming | his f39-50 |
| | grid | clenched teeth: strain, rage held in | his f93-101 |
| | o | gasp, "oh!" | new (Boss gasp O) |
| | wide | the yell: deep lens, top teeth, tongue | new |
| | flat | straight line: unimpressed | new |
| visemes | v_rest v_M | line (pause) / closed lips m b p | his talking "line" / new |
| | v_E v_A | small lens / wide lens (most vowels) | his f1369-77 |
| | v_O | tall O (o u w r) | his f1399-1413 |
| | v_F v_L | flat lens with top teeth (f v) / lens with tongue up (l t d n) | new |
Visemes come from `facetime.js say(words)` (2 f lead, ~2.3 f per shape, eyes still while speaking).

## Talking life (agent P, overnight 2; FABLE_REVIEW 2, 3, 12). All step tracks, snaps only.
- `say()` per phrase: the longest O hold (3 f+) becomes the big O `o` (his f1399); every second short in-speech closing is his slanted
  line `smirk` (f1404); small lens <-> wide lens alternate on long holds (his lens ramp); final hold law: vowels <= 5 f, others <= 3 f.
  Returns `stress: [[t0, t1]]` = the phrase's longest word + any 8 f+ word, 1 f before the mouth, 5-9 f.
- `faceTracks()` brow: on a stressed word `on -> up`, `up -> on`, `down -> on`, `knit -> down`, then back. Eyes: on a phrase start that
  is not the line's first (pause > .6 s), 60 % hashed, `open <-> smug` for that phrase. `alive: false` turns both off.
- Listener: `faceTracks({ listen: [[a, b]] | [{ t0, words }] })` (or `blink.listen`, which compose.js already passes through from
  `timeline.blink.listen`): 3-5 f after each other speaker's line ends -> a blink, or a brow lift 8 f (blink before), or an eye swap 18 f.
  compose.js does not pass `timeline.listen` yet: until it does, put the other speakers' spans in `timeline.blink.listen`.
- Check: `node lab/talk2/stats.mjs` (rate / shapes per line / brow changes on every film line, now vs HEAD), `node lab/talk2/listen.mjs`,
  `node lab/talk2/run.mjs all` + `python lab/talk2/sheet.py` -> `lab/talk2/talk_strip.png`, `walter_az.png`, `faces.png`.

## One hand for every face (agent FC, overnight 2; FABLE_REVIEW2 items 2, 3)
- Eyes, lids, brows and mouths come from the same kit drawings for everyone; `specRange` keeps a spec inside his numbers (one eye size,
  bold brows), so no dot eyes or hairline brows. The original six (engineer boss tycoon inspector passenger townsperson) are never restyled
  (`ORIGINAL` in faceset.js): pixel-identical from the front, checked with `node lab/fc/fc.mjs orig` + `python lab/fc/diff.py`.
- Open mouths: everyone else gets his maroon inside (`kit.params.mouthMaroon` #55202f, ink rim `mouthRim` .045 R): an ellipse fitted to
  the D lens + the gasp O's maroon extra recoloured. The default palette's maroon is ink-dark, so open mouths used to read as black blobs.
- Beards, moustaches and glasses ride the face in the same hand: one flat fill + one bold ink outline (.05 R beards, .058 R glasses frames),
  no hair strokes, no 2-tone crescent, no pencil texture; stubble = ~15 bold specks along the jaw (WARDROBE_API.md).
- Proof: `lab/fc/faces_vs_his.png` (his f1400 / f1345 / f0420 heads next to engineer, boss and 8 new-cast faces, 3 expressions, matched head
  size). Rebuild: `node lab/fc/fc.mjs faces` then `python lab/fc/sheet.py faces lab/fc/out/faces.png lab/fc/faces_vs_his.png`.

## Talk small, shout big (W6, 2026-11-04; FABLE_REVIEW4 item 5)
- His talking mouth is SMALL (f0440-49 a short line that barely opens, f1380-89 a thin lens ~.28 x .065 D); the body does the acting.
  Plain visemes `v_E v_A v_O v_L v_F` now draw the kit drawing scaled down (`TALK` in faceset.js: [width, opening]; engineer units R:
  line v_rest .6 x .125, v_E .37 x .12, stressed v_A .45 x .14, O .16 x .17). No highlight fleck on the small lens. `v_rest v_M` unchanged.
- LOUD = the kit's full drawings: the name + `!` (`v_A! v_E! v_O! v_L! v_F!`). `say()` writes them for a word ending in `!` (or a word
  with `loud: true`), or every word of a line with `loud: true` on the say line (`tl.say: [{ t0, loud: true, words }]`) / `say(words, { loud })`.
  The big O `o` is only promoted inside loud words now (quiet lines keep the small O). `say()` returns `loud: [[t0, t1]]`.
- Shout expressions: `mouth: 'shout'` = `wide` (the yell), `eyes: 'shout'` = `angry`, `brow: 'shout'` = `knit`; `o`, `wide`, `D`,
  `crescent`, `grid` are never resized. `kit.params.talk = { v_A: [w, h], ... }` overrides the factors, `{ off: true }` = the old big talk.
- NOTE for the film tools: `voice/words.json` words carry no punctuation, so a film gets loud talk only if make_film passes `loud`
  (from the line text's `!` or a script line's `loud: true`) into `tl.say`. Clips that need a big open mouth (eat's bite, `open: 'v_A'`)
  should ask for `v_A!`.
- Check: `node lab/w6/test.mjs`; sheets `node lab/w6/w6.mjs talk|seq` + `python lab/w6/talk_vs_his.py` -> `lab/w6/talk_vs_his.png`.

## Moustaches and beards vs the mouth
W6 (FABLE_REVIEW4 item 2): the walrus is ONE clean solid shape (smooth arch, full cheeks, corners drooping past the mouth, smooth lower
edge v .38 centre -> .465), filled with a visible cool grey for pale hair, bold ink outline; no scallops / clumps. Walter's mouth sits just
under it (`kit.cast.walter.mouthV .1`). Proof `lab/w6/walter.png` (`node lab/w6/w6.mjs walter`: az -60..60, el -8/8, head 150/250/400 px).
Pale hair (L > .6) and `bald_sides` stay INSIDE the head's ink ring (hair.js sets head hairR = ballR; `hair.inside: false` = the old
proud shell); the bald_sides band runs even to yaw 132, drops to the nape behind 158 and has a blunt front edge (hairline.js).
Moustache kinds (`moustache walrus handlebar stubble`) draw at renderOrder 19, under the face (20): the mouth always reads over the lower
edge. The walrus ends at v .38-.465 (corners droop to .55); a walrus character drops its mouth (`kit.cast.walter.mouthV .1`). The full
beard's top U stays at v .61 at any `scale` (it used to rise over the mouth when scaled: chef). Full/goatee/mutton stay at 21 (over the chest).

## Proportions (kit.params)
`specRange` clamps what a spec writes: eyeSize .92-1.04 (his cast has ONE eye size), browThick 1.2-1.5 (bold wedges), mouthSize .9-1.15.
`newCast` = defaults for an id with no `kit.cast` entry (browThick 1.3). Kit-fitted cast values only see the outer `range`.
Note: `tools/faceset.py` regenerates kit.json; it must keep `cast.walter`, `cast.pip`, `params.specRange`, `params.newCast`.

## Per-character params (spec.face, all optional; 1 / 0 = the engineer; clamped to his range in kit.params.range)
`eyeSpacing` (x .227 R half spacing, .92-1.2), `eyeSize` (.85-1.15), `eyeV` (R down), `eyeColor` (hex, lids + eggs + ring ink),
`browThick` (x widths), `browV`, `mouthWidth` (x u only), `mouthSize` (x width and opening), `mouthV` (R down).
Cast defaults live in `kit.json` `cast.<id>` (Boss: wider eyes, heavier brows, bigger talking mouth); spec.face overrides them.

## Use
```js
import { faceState, kitReady } from './faceset.js';   // node: setKit(JSON.parse(fs.readFileSync('specs/faces/kit.json')))
await kitReady;
const st = faceState({ eyes: 'smug', brow: 'on', mouth: 'v_A' }, { id: 'boss' }); // cached; pose [0,0,0], flip 1
faceRoot.setFace({ ...st, pose, flip });                // or Face.update(0, { ...ctx, root, face: pose.face }) does it
```

## Add an expression (data only)
1. Add an entry to `tools/faceset.py` (`kit['eyes'|'brow'|'mouth'][name] = {...}`) in decal R units (u right, v down, origin between
   the eyes; eye centres (+-.227, .064), lid line v 0, mouth centre v .382). Strokes = 8 cubic coords + widths (5 for lids/brows,
   7 for mouths); `ms` 'D' fills maroon inside (`inset` = 2 x outline); extras = ellipses with colour ink | eye | white | maroon | tongue | #hex.
   If his video has it, use `med()` over his fitted frames instead of drawing it. Use his weights: lid .05, brow .06-.07, mouth line .045.
2. `python tools/faceset.py`, then `node lab/face/face.mjs all` and look at lab/face/out/states.png. Add an ALIAS if other scripts use another word.

## Horror states + named expressions (agent C, 2026-11-04, the backrooms short)
Data in `engine/faceset.js` `DERIVED` (built from the kit's own drawings, merged on kit load; a kit.json entry of the same name wins):
eyes `stare` (open ovals x1.12; NOT open/smug, so listener gaze and look keys never slide its pupils), `pinpoint` (the shock rings with
a tiny pupil: dawning horror); brow `worried` (resting brow raised, inner ends up), `quizzical` (one up, one down); mouth `tight`
(pressed lips, flat x.55), `gulp` (the gasp O x.6). Presets `EXPR` (a face key may say `{ t, expr: 'fear' }`; facetime.js expands it,
the key's own fields win; preset keys do NOT trigger compose.js's automatic body reactions, write the fields out or add `react`):
fear `wide/worried/grid`, terror `wide/worried/wide`, dread `open/worried/tight`, gulp `open/worried/gulp`, confused
`open/quizzical/flat`, relief `arc/worried/smile` + hold, hope `open/up/smile`, dawning `pinpoint/worried/flat`, horror
`pinpoint/worried/o`, stare `stare/down/tight`, blank `stare/off/rest`. Film table + blink-off syntax: `lab/cast/BR_EXPRESSIONS.md`.
Proof: `node tools/cast_sheet.mjs --cast <ids> --outdir <dir> --expr fear,horror,stare` (bust rows).

## Face rhythm (ENG5, 2026-11-04; the engine enforces it, MOTION_API.md "ENG5 face rhythm limiter")
His rhythm (ref f1400-1409, side f18-24): eyes and brows change at most once per beat (hold >= 8 f; blinks 2 f), brows LOCK during a
line except one raise on the main stressed word, only the mouth flaps while talking, and the closed-eye smile `arc` is a 6-10 f accent
in dialog, then open eyes. Authors: `{ eyes: 'arc', hold: true }` keeps a closed-eye smile on purpose; `faceLimit: false` on a
timeline turns the limiter off (tests only). Keys closer than 8 f still play, just in his rhythm (the later one waits).

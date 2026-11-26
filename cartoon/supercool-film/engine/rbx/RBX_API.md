# Roblox character on charsys (engine/rbx/), V3 2026-11-12

Units D (1 stud = 3.0 / 5.2 D). Everything here is new and additive; no existing charsys file changed for it.

## Body, IK, motion, shading (WP-C1)
`character.js`, `body.js`, `ik.js`, `shade.js`, `creature.js`: see their headers. (WP-C1 owns this section.)

## Head, face, hair, hats, clothes, cast (WP-C2)

### Head (`head.js`)
`buildRbxHead(spec, { light })` -> `{ group, R, H, eyeY, neckY, topY, neck, skin, surface(th, y, lift), face, hair, material, update(faceChannel, opts) }`.
- Shape: round in top view, superellipse profile (flat sides, soft top and bottom edge, exponent 3.4), R .40, H .76 (R15 head x1.15).
  `spec.head.shape: 'monster'` = a boxier, darker-ready head (R .46, rounded-square section) for monster's beast.
- Origin = head centre, +Z = face forward. `neck` = a thin skin stub under the rounded chin: keep it and hide the body's own neck
  (body.js `neck` is wider than the chin and pokes through the face from below; the lab hides it).
- Materials: pass `light` (shade.js `makeLight`). A caller's `material(hex, kind)` also works: head.js reads the light record off
  that material's uniforms and uses `mats.js` for what a plain factory cannot draw (vertex-coloured face and two-tone hair, painted
  maps). Every mesh gets an `ao` attribute (`mats.js ensureAo`); the skin is darker under the chin.

### Face (`face.js`)
The charsys face as is: `faceset.js faceState` (kit.json drawings, EXPR presets, aliases) -> `face.js faceTriangles`, timed by
`facetime.js` (visemes, blinks, listener answers, stress brows), snapping on the frame. Roblox changes only: eyes spread x1.34, the
decal x1.25, ink #1c1c22, dark red mouth inside (#5c1420, the kit's maroons remapped), white teeth / sclera, one small highlight in open
and smug eyes. The decal wraps round the head (u = arc length, v straight), subdivided to .04 R, 2.5 mm proud, each colour run a hair
above the one before (no z-fight rings).
- `head.update(pose.face, { gazeU })`: the channel is `{ eyes, brow, mouth, fx }`. `gazeU` slides the eye zone in decal units.
- gruss's V1 faces (`experiments/roblox-style/engine/faces/FACES.md`) are named: leo_smug blonde_smug bug_eyes classic_smile
  dad_moustache derp_o dion_smirk glasses_frown glasses_worry goofy_tongue happy_derp kid_cry meme_man mom_rage mom_teeth moustache_sad
  noob_angry noob_unamused noob_yell o_eyes squint_frown squint_mad sweat teary mom_red_eyes girl_o sis_scared mannequin_scream dad_shock
  nerd evil monster love, plus his alias words (smug shocked sob furious scream surprised ...; a kit name of the same word wins).
  **Put a goofy name on `brow`**: `{ t, brow: 'kid_cry' }`. Blinks (eyes channel) still close its eyes and talk (mouth visemes) still
  replaces its mouth; facetime's stress / listen brow changes leave a goofy name alone.
- `spec.face.default` (the character's V1 standing face) plays whenever the channel holds only the neutral defaults (open / blink eyes,
  brow `on`, mouth `rest` or a viseme). Any keyed expression wins.
- Extras `fx: ['tears', 'shine', 'blush', 'sweat', 'glint']` on a face key or in `spec.face.fx`; `spec.facial.style`
  (`moustache_big`, `moustache_curly`, `beard_long`) and `spec.mask: true` draw in the face layer in the same hand.
- `monster` draws its eyes in a second unlit mesh (`face.glow`, red + hot core) so post bloom can pick them as emitters.

### Hair, hats, glasses (`hair.js`)
Built in three from the head's own surface (plan said Blender glbs; code instead: no export step, sits on any head with no gap).
Cap shell + bevelled chunks (`roundedBox`), two-tone by height. Hair styles: swept spiky swoop bob long pigtails bun short buzz curly afro
ponytail. Hats: fedora police_cap baseball_cap mailman_cap helmet beanie goggles. Glasses: round square (3D frames + arms).

### Clothes (`wear.js`)
- `wearColours(spec)` -> the `colours` body.js `buildBody` takes (sleeve length per top: tank bare, tshirt / police / overalls short,
  the rest long; shorts / skirt / dress = bare shins; a dress colours the thighs too so the skirt never shows skin at the hem).
- `wearDetails(spec, L, material)` -> `[{ part: 'torsoU' | 'torsoL', mesh }]` in that part's frame: the painted front (canvas texture
  on a panel that follows the bevel: tank neckline, suit shirt + tie + lapels, hoodie strings + pocket + bolt, text print, varsity
  letter, plaid, labcoat, police badge + belt, cardigan, overalls bib, stars / ribbons), hood, collar, belt, skirt. Add each mesh as a
  child of that body part. Needs `document` (canvas): browser only.
- CF2 (2026-11-12 night): also the BACK (own painting per top: racerback, yoke, seams, hood, POLICE, crossed overall straps, dress
  zip + bow, varsity letter, print text), sleeve hems (short) and cuffs (long), thigh pockets front + back (pants), shorts hems, shoe
  sole in a second colour + toe cap. Parts now: torsoU, torsoL, armU*, armL*, legU*, foot*. Sizes read from `L` (armW / armD /
  lowerK when body.js has them). **character.js must call wearDetails** (it does not yet: see v3/review/ISSUES.md).

### Material kinds (`mats.js`)
`KINDS` = skin / cloth / plastic / hair as data (spec, pow, soft, bounce, bK, top, edge); `kindOf(name)` maps a part or detail name
(`head.skin`, `shoes`, `sole`, `print`, `frame`, `hair`, ...) to a kind; `kindUniforms(name)` gives the uniforms. mats.js's own shader
(face decal, two-tone hair, painted panels) uses them; shade.js (CF1) reads the same table.

### Cast (`specs/rbx/*.json`, `kind: "rbx"`)
71 specs: hero.json (levitate_leo, whistle_tyler, love_joey are copies with `hero: true`), every cast member of levitate, monster,
whistle, cantcry, love, sneeze from V1's SHOTS.md / scene.js colours, crowds (`<film>_crowdN`), and `body: creature | dog | totem`
for beast, pale, the dog and the totem (bodies are WP-C1's). Guessed (not in V1's files): sneeze looks (no SHOTS.md), bully / brad print
text "LOL", suit's tie colour, goggle colours, sub's undershirt, the dog's markings.

- Film cast ids: `node lab/rbx/c2.castids.mjs` lists every id the six `films/rbx_<film>/film.mjs` CAST blocks name and whether
  `specs/rbx/<film>_<id>.json` (or an explicit `spec: 'rbx/<name>'`) exists; `--write` adds the missing ones as copies marked `copyOf`
  (V1 copies of one person -> that person, crowd ids `a` / `b_` / `extraN` -> the film's crowd specs in turn). No spec renamed.

### Checks
- `node lab/rbx/c2.mjs hair` -> `lab/rbx/c2.hair_sheet.png` (8 heads x yaw -90..180: hair / hat / glasses gaps).
- Cast sheet V1 column: `python lab/rbx/c2.v1col.py lab/rbx/cast_sheet.png <V1 frame png>` after `c2.mjs cast`.
- `node lab/rbx/c2_node.mjs`: every spec builds through both material paths, every goofy face x (plain, blink, talk) draws.
- `node lab/rbx/c2.mjs all` (headless, muted): `lab/rbx/expr_sheet.png` (16 expressions x yaw -40 / 0 / 40, 400 px), `goofy_sheet.png`
  (33 V1 faces), `talk_strip.png` (levitate's first sentence, every frame at 30 fps), `cast_sheet.png` / `cast_small.png` (8 cast x
  3/4, front, side, back; standing pose built in the lab from body.js). `--ids a,b` picks the cast.

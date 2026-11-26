# Wardrobe API: hair, facial hair, glasses from words (2026-11-04, agent W)

No video, no textures: every piece comes from a few parameters. Proof sheets: `node lab/wardrobe/wardrobe.mjs [hair|face|compare|all]`
-> `lab/wardrobe/out/hair_sheet.png`, `face_sheet.png`, `compare_sheet.png` (engineer's fitted hair vs `lobe`). Head space everywhere:
head centre origin, D = 1, +Y up, +Z out of the face, +X the character's LEFT.

## Hair: `buildHair(spec)` (engine/hair.js) -> `{ headParams, extras, line, colours }`
| key | values | default |
|---|---|---|
| `style` | `short side_part bald bald_sides receding long bob bun ponytail pigtails curly buzz fringe lobe messy spiky` | `short` |
| `colour` | hex or name: `brown dark black grey silver white blond red ginger auburn boss` | `brown` |
| `seed` | integer: the clump pattern of the edge (same seed = same hair) | 1 |
| `front` | front hairline pitch in DEGREES above the head's equator (not a fraction: `front: .5` = at the eyes). Clamped: never below 31 (see "Hair never covers the eyes") | per style |
| `tufts`, `sideTufts`, `tuftLen` | messy / spiky only: tufts on top (6 / 10), per side over the ears (1-2 / 1), length scale (1) | |
| `part` | side_part only: -1 part on his right, 1 on his left | -1 |
| `top` | bald_sides only: pitch of the band's upper edge at the back | 26 |
| `length` | ponytail / pigtails / long: how far the extra hangs (D) | .7 / .3 / .72 |
| `edgeScale` | multiplies every clump size (0 = smooth edge) | 1 |
| `bunAt`, `bunR`, `tieColour`, `curlR`, `slab` (bob: add the short slab) | extras tuning | |
| `anchors` | your own loop `[{ y, p, sharp, e:'scallop'|'jag'|'wave'|'none', a }]`, yaw/pitch deg (yaw + = his left, 180 back, pitch 90 top) | |
| `inner` | `[yaw, pitch]` of a point INSIDE the hair (centre of head.js's map); only for your own `anchors` | `[180, 45]` |

- `headParams` merges into head.js params: `track` (inline `{ hair, hi, axis, e1, e2, shadeAngle, hairTint }`), `hairDark hairLit hairHi
  hairRim`, `lookFrame: 100` (painted ramp + highlight on), `hairlineInk: 0` when bald. head.js renders it unchanged.
  In `engine/character.js` (which builds its own head track): take `line.hair line.hi line.axis line.e1 line.e2` into that track and
  the four colours into the head params.
- `extras`: a Group in head space, rigid with the head: `headObject.add(extras)`. Volumes: bun, ponytail (+ tie), pigtails, long (slab
  behind the neck, hidden behind the torso from the front), curly (bumps; their ink shows only where they cross the head outline).
  Empty group for the flush styles. Outlined with `shade.outline` (.035 D), shaded with the same ramp as the hair shell.
- Colour rule: the given colour is the main/dark fill (as sampled from his frames); lit = same hue L +21 % toward white, highlight +60 %,
  rim +32 % (sRGB HSL). White hair stays near skin, the thin hairline ink does the work. Buzz mixes 25 % toward the skin.

## Facial hair: `buildFacialHair({ kind, colour, seed, scale, pull })` (engine/beard.js) -> Mesh with `.update(faceRecord)`
`kind`: `full` (Worker 3: thick ink U under the mouth ear to ear, hangs about .4 D below the chin, short hair strokes) `goatee`
`stubble` (dots) `moustache` `walrus` (covers the mouth, clumped bottom) `handlebar` (thin, curled tips) `mutton` (chops + moustache).
`colour`: hex or `brown dark black grey white blond red ginger` (default grey). `scale` resizes about the face origin.

## Glasses: `buildGlasses({ kind, colour, eyes, size, seed })` (engine/glasses.js) -> Mesh with `.update(faceRecord)`
`kind`: `round square half` (half-moon readers, sit low) `sun` (dark lenses, one white glint) `cateye` `oval` (ENG10, table below). `colour` = frame (default ink #3a2a33;
gold 0xc9a24a, tortoise 0x6b4a33). `eyes` = `[u, v]` of an eye centre in decal R units (default `[.23, .02]`; engineer about `[.22, .06]`),
`size` default 1.3.

| kind | looks like | sentence words |
|---|---|---|
| `round` | round wire-style rims | "glasses", "spectacles", "round glasses", "specs" |
| `square` | rounded rectangles | "square glasses", "modern glasses", "rectangular frames", "thick-rimmed glasses" |
| `half` | half-moon readers, flat top across the eye, sit low | "reading glasses", "half-moon glasses", "readers" |
| `sun` | solid dark lenses + one glint | "sunglasses", "shades", "aviators" |
| `cateye` (ENG10) | soft lenses whose OUTER top corners sweep up to a point; the arm leaves from the tip | "cat-eye glasses", "cateye frames", "winged glasses", "retro / 50s glasses on a woman", "upswept frames" |
| `oval` (ENG10) | wide soft ovals (.172 x .135 x size), wider than tall | "oval glasses", "oval frames", "small rimmed glasses", "rimless-look / slim glasses" |

ENG10: both new kinds are ONE clean rim stroke (`RIM`, like the others) with the same bridge / arms; `lowered`, `off`, held (ENG8) work
for every kind. A coloured cat-eye frame reads best (`colour` plum 0x6b2d5c, red 0x9b2f35, tortoise 0x6b4a33). Proof:
`lab/eng10/glasses_sheet.png` (3 views, big) + `glasses_small.png` (film head size), `node lab/eng10/glasses.mjs`.
**ENG8:** rims and bridge are ONE uniform stroke of brow weight (`RIM` .092 R, no swell: the swell read as a wobbly double line at
150-250 px heads, Fable review 4 item 2), round lenses radius .168 x size (the eye's outline sits clear inside the rim), arms thinner
(.8 -> .4 FW). Checked at head 150 / 250 / 400 px: `lab/eng8/walter/a150.png a250.png a400.png` (before: `b*.png`; film `lab/eng8/walter`).
**Taking them off (ENG8):** the pose channel `glasses` (`on | lowered | off | hand:R | hand:L`, + `glassesLow` 0..1) picks what draws:
`buildGlasses({ ..., low })` slides the pair down the nose by `low` decal units (character.js builds 4 steps up to `LOWERED` .24 x size/1.3,
lenses 10 % smaller when fully down, the arms still run to the ear); `buildHeldGlasses(spec)` = the same pair flat and front-on (arms
folded = not drawn, .85 scale, depth pulled .6 D like the hats) that character.js turns to the camera and puts beside the drawn hand.
Clips `glasses_lower / glasses_off / glasses_on` and face keys: MOTION_API.md ENG8.

## Mounting beard and glasses (both ride the FACE layer, not the head)
Add them where the face mesh goes (same parent, head space) and call `.update(rec)` every frame with the SAME record the face gets:
`rec = faceRecord(V, ...)` from engine/rules.js (`{ pose, flip, on }`). They use face.js's decal space and pose matrix, so the face slide,
the flip (shading stays lit viewer-left) and on/off (hidden at the back) follow. Pass `surfR` in the record if the face's differs (.4625).
Depth: drawn with depthWrite off after the face (renderOrder 21 beard, 22 glasses) and pulled toward the camera in depth only (beard
full/goatee/mutton .3 D so the part below the chin draws over the torso as his does; others .06; glasses .08).

## Hats: `spec.hat = { kind, ...params }` (engine/hats/<kind>.js; character.js imports the kind's module) (W2, 2026-11-04)
Sheets: `node lab/wardrobe/chars.mjs hats` -> `lab/wardrobe/out/hats_sheet.png` (every hat through engine/character.js, az -60 -20 20 60
150 180); `hair2` -> `hair_sheet2.png`; `walter` -> `walter_sheet.png`. All params optional; colours hex.
| kind | what | params (defaults in each file's `DEF`) |
|---|---|---|
| `hickory` | the Engineer's striped cap (fitted, src/cap.js) | its track |
| `bowler` | Boss / Townsperson / Worker 3 | `crownLit crownDark arc band brimLit brimDark`, shape keys |
| `tophat` | Tycoon / Passenger | see file |
| `officer` | Inspector's officer's cap | `crownLit crownMid crownDark band visor gold badgeR wingW` ... |
| `ballcap` | baseball cap: puffy 6-panel crown, button, curved bill | `crown` (one colour -> lit/dark/arc), `bill`, `backwards: true`, `billR billAng billDrop`, `seams` |
| `flatcap` | flat cap: low cushion leaning over a short peak, dark band (Worker 2) | `crown band`, `newsboy: true` (fuller + button), `fwd stretch droop peakR` |
| `beanie` | knit beanie: ribbed dome pulled low, folded cuff | `crown cuff`, `pom: true`, `pomColour`, `slouch` (D), `ribs` |
| `headscarf` | tied kerchief over top and back, knot + tails at the back | `crown`, `dots` (true), `dotColour`, `back` (tip, deg), `knot: 'back' / 'chin'` |
| `headband` | a band round the forehead, hair visible above it; front above the brows, back lower (FX2). Words: "headband", "sweatband", "bandana tied round the head", "hairband", "tennis/sports band" (a bandana COVERING the crown stays `headscarf`) | `crown` (band colour), `stripe` (colour or null: a stripe through the middle, sweatband look), `knot` (true: knot + two tails at the back = bandana; false = plain sweatband), `width` .1, `y` .22, `back` 12 (tip, deg), `thick` .028. Proof `lab/fx2/headband.png` |
| `strawhat` | straw boater (flat top, band, wide flat brim) | `crown band`, `sun: true` (soft dome, droopy wider brim), `brimR droop` |
| `chef` | chef's toque: pleated band + mushroom puff | `crown crownDark`, `height puff pleats` |
| `none` | no hat | |
Common to the six new kinds (engine/hats/_kit.js, not a kind): `mount { x y z rx ry rz scale }` (y = the band's foot above the head
centre; the kind's DEF sets it), `tilt` (deg, + tips the front down), `turn` (deg about the head's up axis), `cant` (deg roll), `ink`, `inkW`,
`follow` (1 default = rigid on the head; 0 = the bowler's 2.5D layer), `termSoft` (terminator half-width, default .006 = hard edge).
Pose (W3, 2026-11-04): RIGID on the head at `mount`, like the hair painted under it. character.js still writes the hatRecord into
`track.pose[0]`; the kit takes only what the pose hat channels added to the plain rule (lift -> u v, tilt -> roll, spin -> az) and applies
those on top of the mount. Why: the record carries his bowler-layer gains (az x .77/.93, el x .58, roll x 1.17) and re-places the hat on
screen every frame; a one-sided hat (Pip's backwards bill, peaks, brims) then swung and slid against the head (hat_stays_on .07-.08 D,
FABLE_REVIEW 12 "slides down like a hood"). `follow: 0` brings the layer path back. `track.lift[frame]` still lifts it off. Their
`userData.track` has no `shape`, so character.js takes the mount height from `params.mount.y`.
Look (W3): matte flat two-tone, ONE hard antialiased terminator (lit viewer left, held in view space), one thin pale arc on the lit upper
crown only, darker band, seams/ribs/straw as thin crisp painted lines, brims two-tone by screen side (crisp) with the darker underside shown
when the camera is below the brim plane (was by triangle winding: every brim showed its underside colour), ink outline.
Crowns reach above the head top (>= .5 D from the head centre) at every angle, so no skin shows through at the back.
Proof: `node lab/wardrobe/chars.mjs polish` -> `lab/wardrobe/out/polish.png` (Mara Walter Pip bouncer farmer chef teen, az -40 0 40 150,
el -10 and 8); `node lab/wardrobe/chars.mjs spread --spec pip` = the hat pivot vs AABB-centre distance from the head as the body turns.

## Hair fixes (W2, 2026-11-04)
- `bald_sides`: a low band (top edge pitch 26 at the back, 15 at the ear), rounded front ends, soft wavy top edge, lower edge straight
  with ONE jag per stretch (edge kind `'one'` in hairline.js). The dome stays clean skin from every angle. White / near-skin hair
  (lightness > .82) gets his thin line: `hairlineInk` .011 D (override with `hair.hairlineInk`).
- `long`: the neck slab wraps forward less (no collar under the chin from the front). `pigtails`: short bunches tied low behind the ears
  (`length` default .22) with ties. Facial hair `stubble`: a flat jaw shadow (skin tinted 28 % toward the colour) + faint short ticks, no dots.

## Polish (W3, 2026-11-04)
- `bun` / `ponytail` / `long` come forward and down by default so hair reads from LOW film cameras (bun: front pitch 50 -> 33, temples
  38 -> 16 = about the brow line, ear 2 -> -6; long: part 52 -> 40, curtains 28 -> 16). New key `coverage` (0 = the old high line,
  1 = default, > 1 lower; bob: > 1 lowers the bangs). An explicit `front` still wins.
- White / near-skin hair (lightness > .82): ONE flat fill (L +55 % toward white) instead of the ramp (it read as a pale grey patch).
  `bald_sides`: both edges smooth gentle curves (the jags and wavy top read as cracks across the dome); `jag: true` = the old lower edge.
- `stubble`: no fill at all (any tint read as a pale beard); ~260 short dark-grey specks dense on jaw/chin/upper lip, thinning up the cheeks,
  kept inside the head outline and > 40 RGB off the ink colour (so they never break the ink ring: checks turn_ink).
- `goatee`: a thin moustache round the mouth joined to a pointed chin tuft (was a lone blob that read as a tooth); draws under the face
  layer (the mouth reads over it) but keeps the .3 D pull for the tuft over the collar.

## One hand + backs of heads (agent FC, overnight 2; FABLE_REVIEW2 items 2, 3). These supersede the W2/W3 notes above where they differ.
- Facial hair: ONE flat fill (the colour's lit tone) + ONE bold ink outline (.05 R, does not shrink with `scale`), brushy swell only.
  No inner hair strokes, no 2-tone crescent, no pencil texture (they read as a second hand next to his faces). Walrus: 2-3 big clumps a
  side on the lower edge (was a row of small teeth). Full: Worker 3's thick ink U kept (.075 R). `stubble`: ~15 bold specks (a U along the
  jaw + 4 on the chin), > 40 RGB off the ink, never on the outline or the mouth line.
- Glasses: frames in the face's bold weight (`FW` .058 R rim, .046 half-moon top bar, .055 -> .03 R arms, .052 bridge), hashed swell,
  independent of `size`. `sun`: solid dark lenses + one glint (unchanged).
- White hair (lightness > .82): a pale silver mass (dark L .80, lit L .88) + the normal hairline ink (.015 D). Flat white on white skin
  read as a blank head from behind (Walter's horseshoe).
- `bald`: two short bold neck-tendon strokes low on the back of the head (`buildNape`, extras; `hair.nape: false` turns them off). A
  horizontal crease read as a frowning mouth on a blank face, so it is never that.
- `buildBackHair({ colour|color, back = 96, span = 84, waves = 5, amp = 4, ink = .02, seed, top = 14 })` (hair.js): hair over the upper
  back of the head, soft wavy lower edge `back` deg from the crown, one ink line along it, r .49 (over head.js's hair shell .484, inside
  the hull .5) so it covers a fitted patch's jagged back edge: nothing is "cut into" the hat line from behind. Its material draws only
  where the surface faces the camera (and the patch starts lower at the sides), so FRONT views stay pixel-identical (az 0 checked); from
  3/4 front (az 30-60) a sliver shows at the back edge, like his "small lobe from the front". On any hair spec: `hair.back: true | {...}`.
  For the fitted cast (no `spec.hair`) it needs a hook in character.js (owner MO2): `if (spec.backHair) parts.head.add(buildBackHair(spec.backHair))`
  next to `parts.head.add(hairExtras)`, then `boss.json "backHair": { "color": "#5e565c", "back": 92 }`, `passenger.json "backHair":
  { "color": "#3f3238", "back": 94, "seed": 5 }`. Simulated in `lab/fc/fc.html` (`--bh`).
- Proof: `node lab/fc/fc.mjs backs --bh` + `python lab/fc/sheet.py backs lab/fc/out/backs_raw.png lab/fc/backs.png` (az 150 / 180 for boss,
  walter, passenger, bouncer, chef, pip, farmer, blind_gus); `node lab/fc/fc.mjs orig [--bh]` + `python lab/fc/diff.py` = the original
  six unchanged.

## Hair never covers the eyes; messy + spiky (W5, 2026-11-04; blind run 4 stuck points 4 and 6)
- The face decal follows the camera, so on the head the brows sit at pitch ~18 + el (+4 for raised brows): el 8 -> ~26-30. hairline.js
  pushes every hairline vertex within |yaw| 48 of the face up to at least pitch 31 (`BROW_P`, a smooth max: tufts round off, they are
  not sliced flat), the floor falls off to nothing between |yaw| 48 and 72 (temples, long hair's curtains stay). Any style, seed,
  `coverage`, `front` or own `anchors`. Styles whose front was already above 36 are unchanged; `fringe` (24) and `bob` (26) bangs now
  stop at ~31 (just above the brows), Sam (`front: .5`) and Theo (`front: 1`) got a normal hairline instead of hair on the eyes (Theo's
  blond now shows only at the sides under his cap). Limit: a camera higher than el ~12 can still see the brows meet the hairline.
  `browClamp: false` turns it off (only for a deliberate look, e.g. hair over one eye; never from a sentence).
- `messy` (words: messy, tousled, scruffy, unkempt, bed hair, shaggy-short): a short cap with big uneven pointed tufts along the front,
  smaller ones round the sides/back (sizes from `seed`), plus extras: ~6 short tufts standing up on the crown at hashed leans and 1-2
  over each ear sticking out. Flat fill, the hair ramp, bold ink edge; nothing falls on the forehead.
- `spiky` (words: spiky, spiked, punky, gelled up): an even jagged front + ~10 straight spikes over the top + 1 per side.
- Proof: `node lab/w5/hair.mjs --out hair --rows blind4_sam,blind2_theo,mara,pip,teen` -> `lab/w5/hair.png` (az -40 0 40, el -10 / 8),
  `--rows "messy black,messy brown,spiky blond,fringe,bob" --out hair_styles` -> `lab/w5/hair_styles.png`.

## Picking from a sentence
Read it in this order: hair amount (bald / balding / thinning -> `bald`, `bald_sides`, `receding`), length and shape (short, buzz, curly,
fringe/bangs, side parting, bob, long, bun, ponytail, pigtails, messy / tousled / scruffy -> `messy`, spiky -> `spiky`; never `front`
below 40 to fake messiness), colour word -> `colour` (old / elderly default `grey` or `white` if no
colour is said), then facial hair word -> kind (beard / bearded -> `full`; goatee; stubble / unshaven; moustache; walrus / big droopy
moustache; handlebar / curly moustache; sideburns / mutton chops -> `mutton`), then glasses (glasses/spectacles -> `round`; square / modern
-> `square`; reading glasses -> `half`; sunglasses / shades -> `sun`; cat-eye / winged / upswept -> `cateye`; oval -> `oval`). Under a hat prefer `lobe` or `short` (the hat hides the top). Hat words: cap / baseball cap -> `ballcap` (backwards cap -> `backwards: true`), flat cap / newsboy -> `flatcap`, beanie / woolly hat -> `beanie`, headscarf / kerchief / a bandana covering the hair -> `headscarf`, headband / sweatband / hairband / bandana tied round the head -> `headband` (sweatband: `knot: false`, often a `stripe`; bandana: `knot: true`; never a white band on the white head), straw hat / boater -> `strawhat` (sun hat -> `sun: true`), chef / cook -> `chef`, bowler, top hat -> `tophat`, conductor / officer / police cap -> `officer`.
Example: "an old man with a white walrus moustache and round glasses" ->
`buildHair({ style: 'bald_sides', colour: 'white' })`, `buildFacialHair({ kind: 'walrus', colour: 'white' })`, `buildGlasses({ kind: 'round' })`.
Style bible limits: one hair mass, flush with the head (extras are the only bumps: use them for women / crowd variety, not main men),
never hair above a hat, identity from hat + torso + colour first.

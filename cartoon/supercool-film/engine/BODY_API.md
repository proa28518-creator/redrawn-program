# Body + outfit API (engine/outfit.js, built by engine/torso.js `buildCustom`; agent E, 2026-11-04)

A spec's `torso` gets `body` + `outfit` (object). Old string outfits (`'boss'`, `'jacket'`...) and the engineer (`torso: {}`) are untouched.
Units: D = head diameter. Torso space: hem at y 0, top of the torso at `top` (hidden behind the chin above ~.80 of it).
Layer coordinates: **y = fraction of the torso top** (0 hem, 1 top), **x = fraction of the local half width** (0 centre, 1 the side;
+ = viewer right on a front view). Colours = sRGB hex; shading is automatic (lit left -> dark right = srgb^1.25 * .78, pale rim streak
on darks/mids only, ink #3a2a33 on top). Every garment has a plain back (centre seam, vent, straps cross, apron bow) drawn in `b`.

## body
| key | meaning |
|---|---|
| `build` | `slim` (W .64, H .90, legs 1.25, pelvis band) `medium` (.80, .92, 1.25, pill) `stout` (.96, .95, 1.18, egg+band) `egg` (Boss: .94, .98, 1.27) `pill` (Tycoon: .87, 1.0, 1.44) `curvy` (.82, .92, 1.2, pear, no band) `kid` (.64, .56, legs .72, arms .62, band .08) |
| `W` `H` | outer torso width / chin-to-bottom height, D. Stay in the bible: slim .60-.72, medium .75-.87, stout .90-1.00 |
| `band` | pelvis band depth (D; 0 = coat to a rounded hem, no band). The band is painted in `outfit.trousers` |
| `legLen` `armLen` `height` | legs/arms in D; `height` (standing, hat off) sets legLen = height - .95 - H |
| `profile` | own shape: `[[u, w], ...]`, u 0 bottom .. 1 top, w = fraction of W/2 (+ `band`) |
| `depthRatio` `power` | section depth / squareness (defaults per shape) |
Sockets (neck, shoulders, hips) and leg/arm lengths are computed: `torso.userData.sockets`, `torso.userData.bodyInfo {legLen, armLen, W, H, skirt}`.
**Leg length today is read only from `spec.limbs.legLen` / `armLen`** (character.js); put the same numbers there until character.js reads bodyInfo.

## outfit
**Types are checked (FX2, 2026-11-04).** Every colour key (`color buckle buttonColor collarColor dash dots stripes line light trousers ink`)
is a hex string `"#rrggbb"` (or `"#rgb"`), never `true` or a name: a wrong value (`"buckle": true`, `"color": "red"`) falls back to the
default colour (`dots` / `stripes: true` = on, in cream) and prints ONE line `outfit: layer 2 (belt) key "buckle": true is not a colour
("#rrggbb") -> the default`. A number key given a non-number falls back to its default (a numeric string is read as the number), an
unknown key (`colour`, `trouser`) is ignored, an unknown layer type (`cape`) is skipped, each with one `outfit:` warning naming the layer and
key. Before this, `"buckle": true` silently painted the whole torso in ink. Check a spec without rendering: `node lab/fx2/validate_specs.mjs`.
`{ color?, trousers?, ink?, rim? (0/1), skirt?, layers: [...] }`. `color` = innermost cloth (default: the first shirt/blouse colour).
Layers paint in order; a later garment hides an earlier one's details where it covers them (apron over a placket).

| `t` | params (defaults) | draws |
|---|---|---|
| `shirt` / `blouse` | `color`, `collar` 'point'/'round'/'none', `collarW` .42, `placket` (blouse true), `pattern` | whole torso in the shirt colour + collar |
| `jumper` | `color`, `neckW` .36, `neckD` .10, `pattern` | all but a round neck; ribbed neck + hem |
| `vest` / `jacket` / `coat` | `color`, `tip` (.45/.48), `openW` (.55/.45), `lapels` (jacket true), `buttons` (4/1), `buttonColor`, `buttonGap` .09, `welts` true, `belt` (back half-belt), `pattern` | all but the V opening; lapels, inked V, closure line, back seam (+ vent) |
| `apron` | `color`, `bib` .62 (false = waist apron), `width` .62, `bibW` .45, `waist` .16, `to` .82 (fraction of the skirt), `pocket` | bib + neck straps, waist ties all round, bow + tails at the back; on a skirt the panel continues down it (pocket included) |
| `tie` | `color`, `dots`, `stripes` | from the last V's tip to the collar, knot |
| `bowtie` | `color`, `y` .70, `dots` | Boss-style wings |
| `scarf` | `color`, `stripes`, `tail` .38, `pattern` | band round the neck + one tail on the viewer-left chest |
| `belt` | `y` .18, `h` .028, `color`, `buckle` (a colour, default gold `"#e3c25a"`) | strip all round + square buckle front |
| `buttons` | `n` 3, `from` .62, `to` .2, `x` 0, `r` .017, `color` | ink-ringed buttons |
| `pocket` / `welt` | `x` .5, `y` .3, `w` .2, `h` .07, `color`, `flap` | outlined patch pocket / dark slot |
| `placket` | `x` 0, `to` .75 | thin dark line |
| `suspenders` | `color`, `x` .45, `dash` | two straps front, two back, pale dashes |
| `pattern` | as below | over the whole torso as painted so far |

`pattern: { type, color, scale, ... }` on any garment or skirt: `stripes` (horizontal: `every` .10, `width` .045, `from` `to` in y units),
`vstripes` / `pinstripe`, `lines` (Passenger), `tartan` (`every` .16, `width`, `line`), `speckle` (Boss), `tweed` (`light`, `strength`), `dots`.
Bible rule: at most one busy pattern per character, low contrast except tartan.

## skirt (`outfit.skirt`)
`{ color, length: 'knee' | 'ankle' | D, shape: 'aline' | 'bell', flare 1.35, pleats 0 (count), pattern, depthRatio 1.05, zOff .07 }`.
A separate mesh from the waist down, same flat shading + crescent ink + an ink hem; legs (ink sticks) come out under it.
**Seated / kneeling (FX2, 2026-11-04): automatic, nothing to write.** When the drawn legs run forward (a `sit` / `sit_down` / `kneel`
clip, any pose whose thigh goes flatter than 55 deg below horizontal for more than ~.1 D), the skirt drapes: down from the waist, forward
over the lap along the most forward thigh (front panel on top, back panel under it on the seat, flattened), then hangs straight down from
the knee to just above the floor (an ankle skirt that would reach past the floor is shortened evenly). It folds in as the thighs come
forward (sit_down / stand_up are smooth). Standing, walking and running skirts are drawn by the old shaders, pixel-identical.
Tuning (rarely needed): `torso.skirtDrape: { lift .05 (lap height over the leg line), flat .32 (lap thickness vs standing), kneeFwd .04,
hemUp .05 (hem above the floor) }`; `torso.skirtDrape: false` = the old straight skirt (it then passes through a bench seat).
Proof: `lab/fx2/seated.png` (top before, bottom after; Nora + Mara on the park bench and kneeling, az -40 0 40 +-90).
The drape only engages with LOW hips (hip height / drawn leg length under ~.8): running strides throw a thigh forward too and stay
straight (`lab/fx2/run_sitdown.png`). Known gaps: `kneel` gets only a slight drape over the front thigh (its hips sit at ~.65 of the drawn
leg, half inside the gate), so a kneeling ankle skirt still reaches the ground mostly straight (the ground hides the part below it);
sit_down's own feet jump forward in one frame (f80->81 of the clip, legs too), so the lap folds in over ~2 frames; a seated character
with the knees wide apart still gets one lap between them.
Trousers / shorts: no mesh. Legs are ink sticks for everyone; trousers = the pelvis band colour (`outfit.trousers`), shorts the same on a kid.

## From a sentence to a spec
"a short round man in a green apron over a striped shirt" (lab/body/specs/grocer.json):
1. Build: *short round man* -> `build: 'stout'` (round = egg/stout; *short* = legs at the low end, `legLen: 1.1`; never scale the head).
2. Innermost first: *striped shirt* -> `{ t: 'shirt', color: '#f1ece6', pattern: { type: 'vstripes', color: '#6f88b8' } }`.
3. Over it: *green apron* -> `{ t: 'apron', color: '#4f7a4a' }`. No skirt, so it hangs to the torso hem; trousers default dark.
4. Unsaid things: pick from the bible (hat first, one strong colour, 3-6 details for a main character, 1-3 for crowd).
5. Leg and top words map to exact keys (W5, 2026-11-04; legs are ink sticks for everyone, so all leg wear is the pelvis band colour):
   | word | keys |
   |---|---|
   | shorts | `outfit.trousers: "<colour>"` (bare ink-stick legs below it are right: nothing else to write) |
   | trousers / pants / slacks | `outfit.trousers: "<colour>"` (no colour said: leave it out, the default is dark) |
   | jeans | `outfit.trousers: "#3f5a86"` (denim blue; "black jeans" `"#2e2c34"`) |
   | hoodie / hooded top | a jumper with a wide deep neck (the hood-ish collar) + a kangaroo pocket: `{ "t": "jumper", "color": C, "neckW": .44, "neckD": .14 }`, `{ "t": "pocket", "x": 0, "y": .26, "w": .44, "h": .12, "color": <C a shade darker> }`. There is no hood mesh; never a `scarf` for it |
   | jumper / sweater / pullover | `{ "t": "jumper", "color": C }` (defaults neckW .36, neckD .10) |
   The band only shows on builds with one (`slim` .13, `stout` .09, `egg` .09, `kid` .08; `medium` `pill` `curvy` have none: add `body.band: .1`), else the trousers colour is not seen.
6. Render the turnaround: `node lab/body/run.mjs --chars <id>` then `python lab/body/sheet.py <ids> after <sheet>.png`, look at it.

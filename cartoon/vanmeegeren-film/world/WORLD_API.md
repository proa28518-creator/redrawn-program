# World API (agent G, 2026-11-04): sets + character shadows

Units D, ground y = 0, a camera looking down -Z sees the set's front. Sun = `set.lightDir` (direction TO the sun, behind-left of that
camera, ~47 deg up): lit surfaces warm, shadow cool blue. Sets are scaled to the CAST (engineer 2.8 D tall, hipY 1.17), not to metres.

## How a film picks a set
`film.json` `world.set` = a **name** (`bread_corner`, `workshop_yard`, `harbour_pier`, `park`, `kitchen`, `city_street`, `plain`) or a
**description object** (the kit below). Both are built by `world/sets.js buildSet(THREE, scene, set, world.setOpts)` and get the sun
shadows (`shadow.js`) and the warm-lit / cool-shadow light. `world.setOpts` overrides the set's own values (sky, sun, ground...).
Write the mark numbers into the cast's `at` / walk paths (film.json does not read marks); the stage scene format also takes `root.mark`.
Hook in `lab/stage.html` (agent Q): string -> `buildSet(...)`; object -> `buildSet(...)` too, the old boxes-only builder only when it returns
null. An object set without its own `sky` keeps the host's `scene.background` (from `world.sky`) as a flat sky; give it a `ground`
(the host does not pass `world.ground` into setOpts, so an object set without `ground` gets the default sand ground).

## Describe a set (the kit): plain JSON, any key optional
Units D (head diameter). The cast: adult head top ~2.6-2.8 D, waist (hipY) ~1.17-1.29, the sit clip's seat .55. Camera side = +Z,
keep the action in x -6..6, z -2..3 (a 9:16 wide at 26-30 D away only shows ~12 D across). Defaults are cast-scaled: door 3.2 x 1.6,
counter 1.25 (waist), table 1.15, bench / stool seat .55, rail 1.35-1.4, lamp 6.5, tree 9.
```json
{ "name": "fish_shop",
  "sky": "day",                                   // day | sea | dusk | overcast | indoor | "#hex" | {top,hor,low}
  "sun": { "dir": [-0.5, 0.74, 0.45], "warm": "#fff2dc", "cool": "#9aa4d6" },   // dir = TO the sun (behind-left of the camera)
  "ground": [ { "kind": "paving", "color": "#cfc4b0", "x": [-30, 30], "z": [-3, 6], "tile": 4 },   // paving|boards|grass|sand|floor|dirt|planks
              { "color": "#8f8c88", "z": [6.5, 60], "y": -0.3 } ],                                 // + "thick": 1.4 = a raised slab (pier)
  "water": { "z0": -3.5, "z1": -200, "y": -1.1, "color": "#5d93b4" },
  "walls": [ { "x": 0, "z": -3, "w": 14, "h": 9, "th": 8, "ry": 0, "color": "#e6c49a", "tex": "plaster",   // x,z = middle of the FRONT face
               "door": { "x": -3, "h": 3.3, "color": "#2f5a4a" }, "windows": [ { "x": 2, "y": 0.9, "w": 5, "h": 2.8, "shop": true } ],
               "sign": { "text": "FISH", "y": 4.3, "w": 8, "h": 1.1, "bg": "#2f4a5e", "fg": "#f0e6cc" }, "awning": { "x": 2, "w": 5.8 } } ],
  "boxes": [ { "size": [1.1, 0.8, 0.9], "at": [-3, 0, -2.4], "color": "#9a7048", "tex": "planks", "ry": 20 },
             { "size": [0.6, 0.9, 0.6], "at": [4, 0, -2], "color": "#3a4a5a", "shape": "cyl" } ],
  "stripes": [ { "at": [0, 1.3], "size": [40, 2.6], "color": "#d8c49a", "tex": "sand" } ],
  "posts": [ { "x": 2, "z": -3, "h": 0.6, "r": 0.32, "cap": true } ],
  "fences": [ { "from": [-14, -3.2], "to": [-1, -3.2], "h": 1.35, "gap": 2.4, "rails": 2, "color": "#e9e2d2" } ],
  "trees": [ { "x": 6, "z": -5, "h": 9 } ], "bushes": [ { "x": -8, "z": -3, "s": 2 } ],
  "benches": [ { "x": -2.5, "z": -1.6, "ry": 0, "w": 4.2 } ],
  "counters": [ { "x": 3, "z": -2.3, "w": 5, "d": 1.3, "h": 1.25, "ry": 0 } ],
  "tables": [ { "x": -2, "z": 1, "w": 2.6, "d": 1.7, "h": 1.15 } ], "stools": [ { "x": -3.8, "z": 1 } ],
  "lamps": [ { "x": 7, "z": 5, "h": 6.5 } ],
  "huts": [ { "x": -6, "z": 0.6, "w": 4.2, "d": 3.4, "h": 4.2, "color": "#6f97b0", "roof": "#b84a3a", "door": { "x": 0.7 }, "window": { "x": -1.1 } } ],
  "signs": [ { "text": "PIER 3", "x": -6, "y": 3.4, "z": 0.74, "w": 2.4, "h": 0.6, "post": false } ],
  "marks": { "a": [-1.4, 1.2], "b": [1.4, 1.2], "door": [-3, -2.2], "enter_l": [-14, 2], "enter_r": [14, 2] },
  "points": { "counterH": 1.25 }, "bounds": { "x": [-14, 14], "z": [-3.5, 7] } }
```
(JSON has no comments: drop the `//` notes.) The old ad-hoc format (`{ boxes: [{size, at, color, shape, ry, ink, base:false}], stripes }`,
films/blind1) is a valid description: it now gets sun shadows (`lab/world/blindpier.json`). Boxes sit ON `at[1]` unless `base: false`;
`ry` is degrees everywhere; walls/huts/benches/counters with `ry` rotate about their own (x, z). Everything casts except walls and grounds.

## `buildSet(THREE, scene, nameOrDescription, opts)` (`world/sets.js`)
Returns `{ name, group, lightDir:[x,y,z], skyColor, marks:{name:[x,z]}, points:{...}, bounds:{x:[a,b], z:[a,b]}, casters:[meshes], uniforms, update(t) }`.
Adds a sky dome + sets `scene.background` (opts.background false keeps yours). ~40-60 draws, one tiny lit shader, canvas textures, no files.
| set | what | marks | points |
|---|---|---|---|
| `bread_corner` | pavement + kerb + road, plaster shop front (door, window, BAKERY sign, striped awning), corner + side street, building across, bread stand with loaves, lamp post, 2 pots | `baker` (behind the stand), `customer`, `customer2`, `center`, `door`, `lamp`, `enter_l/_r`, `exit_l/_r` | `standTop`, `loaf` [x,y,z] (the last loaf), `standFront`, `standBack`, `wallZ` |
| `workshop_yard` | dirt yard, plank shed with a real open doorway (dark interior + floor + a dim veil, so a character walking in goes dark), bench under a window, crates, barrel, fence, tree | `sit`, `sit2` (bench seats), `bench_front`, `stand`, `center`, `door` (threshold), `door_in` (inside), `enter_l/_r` | `seatY`, `benchZ`, `wallZ`, `doorX` |
| `harbour_pier` (kit) | raised plank pier over water both sides, running toward the camera to z 40 (W5: wides from z 17-30 showed its end as a band), edge beam, rail (left), 3 bollards (seat .6), crates, rope drum, blue hut with door + PIER 3 sign, moored boat, lamp | `a` [-1.5, 1], `b` [1.5, 1], `center` [0, 1], `edge` [3.4, -2.4] (at the water), `bollard` [5.6, -2.55] (sit, seat .6), `hut_door` [-5.7, 1.9], `enter_l` [-14, 2], `enter_r` [14, 2] | `seatY` .6, `edgeZ` -3.5, `waterY` -1.1, `bollards` |
| `park` (kit) | grass, sand path along x (z -.1..2.7) + one going back, bench with back, 3 trees, bushes, lamp, bin, far fence | `sit` [-3.4, -1.6], `sit2` [-1.6, -1.6], `bench_front` [-2.5, -.2], `a` [-1.3, 1.3], `b` [1.3, 1.3], `center` [0, 1.3], `tree` [3.6, -2.6], `lamp` [-6, .2], `enter_l` [-14, 1.3], `enter_r` [14, 1.3] | `seatY` .55, `benchZ` -1.6, `pathZ` |
| `kitchen` (kit, interior, open front) | tiled floor x -7..7 running to z 60 (W5: no dark band in wides), back wall z -3 with window + door (x -5.2), side walls to z 20, counter (h 1.25) with sink + a STOVE at its right end (x 5.6: hob with 4 burners, red pot with lid, saucepan with handle, oven door on the front; W5), fridge, table (h 1.15), 2 stools (.55) | `counter` [3.6, -.95], `counter2` [1.4, -.95] (stand at the counter, ry 180 faces it, ~150 half-turned to camera), `stove` [5.6, -.95] (stand at the hob, same ry rule; stirring hand ~[5.4, 1.5, -2.2]), `fridge` [-2.6, -.8], `stool_l` [-4.2, .9], `stool_r` [-.6, .9] (sit), `table_front` [-2.4, 2.4], `door` [-5.2, -2.3], `a` [-1.3, 2.4], `b` [1.5, 2.4], `center` [0, 2.2], `enter_l` [-6, 4.5], `enter_r` [6, 4.5] | `counterH` 1.25, `tableH` 1.15, `seatY` .55, `wallZ` -3 |
| `city_street` (kit) | pavement, kerb, road, CAFE (plaster, door x -9.8, shop window + awning) and BOOKS (brick, door x 9.8, shop window) fronts, building behind, lamp, post | `door1` [-9.8, -2.2], `door2` [9.8, -2.2], `window1` [-4.6, -1.4], `window2` [4.6, -1.4], `a` [-1.4, 1.2], `b` [1.4, 1.2], `center` [0, 1.2], `kerb` [0, 5.4], `lamp` [7.4, 4.4], `enter_l` [-14, 2], `enter_r` [14, 2] | `wallZ` -3, `kerbZ` 6.25, `roadY` -.3 |
| `plain` | ground (opts.ground colour) + sky | `center` | |
opts: `standH` (1.25 = the cast's waist; the brief's 2.3 is head height for this cast), `seatH` (.55 = the motion `sit` clip's hipY, legLen*.42;
the brief's 1.25 would be above a standing hem), `lightDir`, `lit`/`shade` tints [r,g,b], `sky {top,hor,low}`, `ink`, `ground`, `bounds`.
Sit on the bench: root at `marks.sit`, ry 0..20, pose `body {hipY: points.seatY - .02, sit: 1}`, feet `in:'root'` at z +.5 (lab/world/yard.json).

## `attachShadows(THREE, scene, renderer, characters, lightDir, opts)` (`world/shadow.js`)
-> `{ update(), camera, target, ms(), receive(uniforms), dispose() }`. opts: `{ set, size 2048, bounds, casters, soft 1.2, bias .0006, blob {color, opacity .42, size .62} }`.
How: the characters are 2.5D (shape depends on the camera) and their shaders move vertices, so a flattened copy of the meshes would be
wrong. The shadow is the character AS THE SUN SEES IT: per frame each character is updated once for a near-orthographic sun camera
(update is pure in (pose, camera)), drawn with the set's casters (stand, lamp, bench, crates; hand props too, anything under `ch.root`)
into one depth map, then updated again for the real camera. Every set surface reads that map (5x5 soft compare): one flat cool shadow
on ground, walls and props, no double darkening, depth-correct (nothing in front of a character is shadowed). Plus a soft contact blob per
foot that fades as the foot lifts. It wraps each `ch.update` to remember the last main-camera call: call `shadows.update()` after the
characters' update for the frame and before `renderer.render`. Cost (RTX 5080, 1080x1920, 2 characters): ~3-5 ms of a 5-8 ms frame.

## How to add a set
Easiest: a new entry in `KIT` in `world/sets.js` (a description object as above) AND its name in `isKitSet` (tools/make_film.mjs finds
world sets by the text `name === '<set>'` in sets.js). Check it with `node lab/world/stage.mjs --json lab/world/<scene>.json --frames 0,30,60`
(three camera keys = wide / medium / low) and `lab/world/sheet_kit.py <scene>` -> `lab/world/out/kit_<scene>.png`.
Hand-built: a new `else if (name === '...')` branch in `buildSet`: `floor(x0,x1,z0,z1,colour,texture,tileD)`, `box(w,h,d,colour,[x,y0,z],{map,rep,ink,cast,ry,parent})`
(sits ON y0), `cyl(...)`, `blobby(...)` (ellipsoid); textures in `TEX` (canvas, multipliers around white). Set `marks`, `points`, `bounds`
(the action area: it frames the shadow map, keep it ~28 x 10 D). Big walls `cast: false`. Check it with `lab/world/stage.mjs`.

## Integration lines for agent F (`lab/stage.html`)
```js
import { buildSet } from '../world/sets.js';
import { attachShadows } from '../world/shadow.js';
let set = null, shadows = null;
// stageInit, instead of the ground mesh + grid (keep them only when !sc.set):
set = buildSet(THREE, scene, sc.set || 'plain', sc.setOpts || {});            // after scene.background is set: the set's sky wins
//   per character def: if (c.root?.mark) { [c.root.x, c.root.z] = set.marks[c.root.mark]; }
// after the characters loop, instead of the blob() meshes:
shadows = attachShadows(THREE, scene, renderer, chars.map(c => c.ch), set.lightDir, { set });
// stageFrame, after the chars.forEach(ch.update ...) loop (drop the blob positioning), before renderer.render(scene, camera):
shadows.update(); set.update(t);
```
Reference host with all of it (+ marks, + `walk` paths via engine/walk.js): `lab/world/stage.html`; scenes `lab/world/*.json`.

## Known gaps
- Characters are unlit: they don't darken in a prop's shadow (the doorway veil is the only indoor dimming).
- The sun-view silhouette uses the 2.5D rules for the sun's angle: right for a steep sun; legs are thin in the shadow (as drawn).
- Sets are clean blockouts (plain colours + canvas textures), not his world's beauty pass.
- Wides (W5, 2026-11-04, `lab/w5/wide_<set>.json`, cameras z 17 low / z 22 / z 30 high): kitchen + pier fixed (floor/pier extended);
  park, workshop_yard fine; city_street and bread_corner show the kerb + plain grey road across the bottom (that is the road, no
  markings yet, so a low wide reads it as a flat band: frame it out or keep the camera above y 3).

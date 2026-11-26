# Props API (agent PR, 2026-11-04)

Props in films: `film.json` `props: [{ id, kind, owner, in, at, rot, keys, ...opts }]` (tools/FILM_API.md for `in` / `keys` / `handovers`).
The stage builds each one with `await makeProp(kind, { ...entry, film })` (`lab/film/props.js`) and places it every frame with `placeProp`.
Units D (1 = the head diameter). Every prop's ORIGIN IS THE GRIP: the point that sits in the drawn hand.
Sheet of every kind at 3 angles + four holds on a character: `lab/props/out/props_sheet.png` (`node lab/props/run.mjs`, ~20 s).

## Where a kind comes from (first hit wins)
1. Built-in in `lab/film/props.js`: `cane loaf half_loaf mug newspaper box` (+ aliases `bread_loaf` = loaf, `bread_half` = half_loaf).
2. `engine/props/<kind>.js`: the kit below, and his video's props (`teacup sign marble`: these are track-driven, origin = their centre,
   not a grip; `purple steam saw` need their tracks and show nothing / fail without them).
3. `films/<film>/props/<kind>.js`: a prop only one film needs (`<film>` = the film folder's name).

An unknown kind stops the film with an error naming all three places. Kind names: lowercase letters, digits, `_`; a leading `_` is a
helper file, never a kind (`_kit.js`, `_template.js`).

## Placing (`in`)
| in | origin goes to | turned by |
|---|---|---|
| `hand:R` / `hand:L` | the owner's DRAWN hand (+ `at`, body space) | the body's facing, then `rot` (deg x y z) |
| `body` (new) | the owner's hips (hem point) + `at` (body space: +X his LEFT, +Y up, +Z forward) | the body's facing, then `rot` |
| `world` | `at` (world) | `rot` |
| `hidden` / `release` | hidden / dropped where it was | |
With `rot [0,0,0]` a prop's local axes are the body's: +X his left, +Y up, +Z forward (toward a camera he faces).

## The kit (`engine/props/<kind>.js`; `side` mirrors the grip for the left hand, default from `in`)
| kind | opts (defaults) | sockets (prop space) | how it's held |
|---|---|---|---|
| `camera` | `color` #2c2c34, `plate` #c9c9cf, `lens`, `flash` 0..1 (white burst), `side` | `eye` (viewfinder), `lens`, `flash` | grip = the outer end of the body; lens +Z. Up to the eye: armR.hand ≈ [-.42, head-centre-height-above-hips, .8] body space (Dot: [-.42, 1.24, .8]), armL ≈ [0, -.1 of that, .85] under the lens |
| `umbrella` | `open` 1 (0 = closed + strap), `colors` [#c8433a, #f2ece0], `segments` 8, `radius` 1.0, `shaft` 1.4 | `top`, `rim` | grip on the J handle, shaft +Y. Over the head: hand OUT to the side past the head ([-.66, .9, .4] for Dot), `rot [0,0,-9]` tips the canopy over the head (a hand in front of the face hides the shaft behind the head) |
| `phone` | `color`, `screen` #8fc3e6, `on` true | `screen`, `top` | screen +Z; look at it: `rot [-20,180,0]`; to the ear: `rot [0,90,0]` |
| `book` | `open` 1 (0 closed), `color` #a8402f, `pages`, `w` .36, `h` .5, `title` | `grip2`, `spine`, `pages` | open: pages face the holder (-Z), covers the camera. TWO HANDS below |
| `bag` | `strap` 'hand' / 'shoulder', `color` #8a5a32, `flap`, `buckle`, `w h d`, `shoulder` [-.32,1.05,.02], `chest` .34 | `bottom`, `strapTop` / `hip` | 'hand': grip = top of the handle loop. 'shoulder': `in:'body'`, `at` ≈ [.46, .05, .12] (his left hip), `shoulder` = his right shoulder relative to that origin (Dot: [-.8, .72, -.1]; = rest.shoulderR - at). The strap crosses in front of the chest |
| `ball` | `r` .2, `colors` (4 gores; one colour = plain ball) | `centre` | grip under the ball; on the ground: `in:'world'`, `at [x, 0, z]` |
| `cup` | `sleeve` #c9824a, `color`, `lid`, `h` .32 | `lip` | paper take-away cup; sip = bring `lip` to the mouth |
| `bottle` | `color` #4f9a6a, `label`, `cap`, `h` .38 | `mouth`, `base` | grip mid-body |
| `broom` | `length` 1.9, `grip` .35 (handle above the grip), `color`, `straw`, `band` | `grip2` (.5 lower), `top`, `bristles` | handle hangs -Y to the head (like the cane); sweep: two hands, `rot [30,0,0]` |
| `fishing_rod` | `length` 2.8, `line` 1.4 (0 = none), `color`, `cork`, `bobber` true | `tip`, `reel` | rod +Y; `rot [-40,0,0]` tips it out; the line always hangs world-down from the tip |
| `flowers` | `n` 7, `colors`, `wrap`, `seed` 3 | `heads` | grip = the wrap's waist; offer: arm out, `heads` toward the other person |
| `letter` | `paper`, `stamp`, `seal`, `w` .5, `h` .32, `side` | `centre` | front (+Z) address + stamp, back flap + seal; grip at the short edge |
| built-in `newspaper` | `title`, `headline`, `backline`, `paper`, `ink` | `centre` | printed BOTH faces (front: masthead, headline, picture, columns; back: page 2) |

## Two-hand holds
A prop with `sockets.grip2` (book, broom) is held by the `in` hand at the origin and the other hand at `grip2`. Put the second hand's
pose target at `armR.hand + grip2` (both `in:'body'`, prop `rot [0,0,0]`; a rotation about X, like the book's `rot [30,0,0]` tilt, keeps
an X-only `grip2`). Open book: `grip2 = [.70, 0, 0]` -> Dot reading: armR [-.35, .6, .6], armL [.35, .6, .6], book `rot [30,0,0]`.
The drawn hands are the reach-limited, shoulder-corrected ones (character.js), so check the frame; one hand drives the prop.

## Add a prop (one new file, nothing else to edit)
`engine/props/<kind>.js` (every film) or `films/<film>/props/<kind>.js` (one film):
```js
import { THREE, flat, basic, part, finish, sideOf, canvasTex, hangDown, rng } from '../../../engine/props/_kit.js'; // from engine/props: './_kit.js'
export const free = true;                       // a free-pose prop (not one of his track-driven ones)
export function build(o = {}) {                 // may be async; o = the film entry (+ kind, film)
  const g = new THREE.Group();
  const body = part(new THREE.BoxGeometry(.3, .2, .1), flat(o.color ?? '#c8433a'), .022); body.position.y = .1; g.add(body);
  return finish(g, { tip: [0, .2, 0] });          // origin = the grip; sockets in prop space (grip [0,0,0] added)
}
```
His look: `flat(lit, dark?)` = two tones with one hard terminator (sun from upper left front), `part(geo, mat, w)` adds the ink outline
(`w` .012-.025 D for props; characters use ~.06), `basic(color)` for print, glass, screens; muted warm colours, ink `#3a2a33`.
Sizes in D: a mug .26 wide, a hand radius ~.06, an adult hand at the hip ~1.1 above the ground. Keep it pure (same opts = same prop;
`rng(seed)` for scatter) and per instance (no module state). Check it: add it to `ITEMS` in `lab/props/run.mjs`, run, read the sheet.

## Limits
- `in:'body'` follows the hips and facing, not lean / twist / squash (a hard bend swings the bag's strap off the chest).
- `teacup sign marble purple steam saw` (his video) still read their per-frame tracks; as free props they have no grip origin.
- `engine/props/newspaper.js` (his video's paper, a double-sided plane) still shows its print mirrored from behind; films use the built-in one.

// lib/rbx/filmkit.js: the Roblox Lightweight film tables -> a charsys film (MADE BY charsys tools/export_suite.mjs from
// experiments/roblox-style/v3/tools/filmkit.mjs = filmkit_lab.js; never edit by hand). A project's scenes/film.js:
//   import { build, q30 } from '../lib/rbx/filmkit.js';
// build() = the lab's, with the app's voice (audio/clean.wav + audio/clean.json, the tightened, word-timed voice) and the export's post:
// two sub-frames per frame (t and t + post.blur seconds: the 0.5-frame shutter of the V4 films) averaged, and the V4 grade.
import { build as labBuild } from './filmkit_lab.js';
export { camOf, previzSet } from './filmkit_lab.js';
export const POST = { blur: 1 / 60, grade: { saturation: 1.18, contrast: 1.05 } };
/** a time on the 30 fps grid (every cut: a blurred frame never mixes two shots) */
export const q30 = t => Math.round(t * 30) / 30;
export function build(o) { return labBuild({ voice: { file: 'audio/clean.wav', words: 'audio/clean.json' }, post: POST, ...o }); }

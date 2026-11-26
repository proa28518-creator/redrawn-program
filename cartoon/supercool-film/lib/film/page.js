// lab/film/page.js: a charsys film rendered INSIDE a browser page, no node, no puppeteer, no python (2026-11-04, port job). The app's
// host page (templates/host/chost.js) imports it from templates/cartoon/engine.js; tools/export_suite.mjs copies it to lib/film/page.js.
//
//   const F = await initFilm({ engineBase, projectBase, film, cameras, quality, size, width, height, canvas, captions, log })
//   size [W, H]: the frame to draw the film in, over the film's own `size` (a wide project: [1920, 1080]); width / height then scale it
//   lang: the captions' language ('vi', 'th' ...), over the film's own `language` (Vietnamese, Thai, Hindi, Russian, CJK: bundled fonts)
//   const r = await F.frame(t)        // draws the frame at t seconds (pure in t: seeking back gives the same pixels), r = { canvas, ms, views }
//   F.info                            // { kind, name, dur, N, fps, W, H, look, gradedInFrames, grade, gl, msaa, lines, words, shots, voice }
//   F.still(t, type, q)               // the frame at t as a data URL (default image/jpeg .93, what make_film writes)
//   F.resolved                        // = the resolved.json make_film writes ({ ...scene, dur, N, lines })
//   F.propTrack()                     // the PROP GUARD's numbers for the frame just drawn
//   F.dispose()
//
// URLs: film, cameras, the voice words, a cast spec given as a .json path, the film's set.js and props/<kind>.js load RELATIVE TO THE
// FILM (the folder of the film file), each falling back to the PROJECT base (projectBase); engine/, specs/, src/, tracks/, world/ load
// relative to the ENGINE base (where this file sits: engineBase is informational, the engine's own imports are relative).
//   example films: projectBase = <engine>/examples/<film>/, film = 'film.mjs' | 'film.json' (voice/, props/, cameras/ next to it)
//   a member's project: projectBase = <project>/, film = 'scenes/film.js' (scenes/set.js, scenes/props/, scenes/cast/, voice in audio/)
// Every step tools/make_film.mjs takes to resolve a film happens here through the same code (lab/film/resolve.js + end.js): own voice
// words split into the lines, line: times, timelines, hand-overs, sit_on, prop clips, collar tracks, listener gaze, rests, film end,
// closed mouths, lowCams, autoMove, endFraming. `cameras` = make_film's --cameras FILE (its shots replace the film's, endFrame off).
import { createStage } from '../stage.js';
import { resolveFilm, captionFn, guardSnaps } from './resolve.js';
import { CLIPS } from '../../engine/clips.js';

const href = (u, base) => new URL(u, base).href;
async function exists(url) { try { return (await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok; } catch { return false; } }
async function getText(url, what) {
  let r; try { r = await fetch(url, { cache: 'no-store' }); } catch (e) { throw new Error(`FILM FAILED: ${what} could not be loaded: ${url} (${e.message})`); }
  if (!r.ok) throw new Error(`FILM FAILED: ${what} not found: ${url} (HTTP ${r.status})`);
  return r.text();
}
async function getJson(url, what) {
  const s = await getText(url, what);
  try { return JSON.parse(s); } catch (e) { throw new Error(`FILM FAILED: ${what} is not valid JSON: ${url} (${e.message})`); }
}
/** the film file -> the film object (film.js / film.mjs: export default {...}; film.json: JSON) */
export async function loadFilm(url) {
  if (/\.json(\?|#|$)/i.test(url)) return getJson(url, 'the film file');
  let mod; try { mod = await import(url); } catch (e) { throw new Error(`FILM FAILED: the film file ${url} does not load: ${e.message}`); }
  if (!mod.default || typeof mod.default !== 'object') throw new Error(`FILM FAILED: ${url} must \`export default { ... }\` (the film)`);
  return mod.default;
}
/** the first base under which rel exists (HEAD), else the first base */
async function firstOf(rel, bases) {
  for (const b of bases) { const u = href(rel, b); if (await exists(u)) return u; }
  return href(rel, bases[0]);
}

export async function initFilm({ engineBase, projectBase, film = 'scenes/film.js', cameras = null, quality = null, size = null, width = null, height = null,
  canvas = null, captions = true, lang = null, log = (...a) => console.log(...a) } = {}) {
  const T0 = performance.now();
  engineBase = href(engineBase || '../../', import.meta.url);
  projectBase = href(projectBase || engineBase, location.href);
  const filmUrl = typeof film === 'string' ? href(film, projectBase) : null;
  const filmDir = filmUrl ? href('./', filmUrl) : projectBase;
  const parts = filmDir.replace(/\/+$/, '').split('/');   // the film's name = its folder (a project's scenes/ -> the project folder)
  const name = decodeURIComponent((parts[parts.length - 1] === 'scenes' ? parts[parts.length - 2] : parts[parts.length - 1]) || 'film');
  const src = filmUrl ? await loadFilm(filmUrl) : film;
  const F = { ...src, world: src.world ? { ...src.world } : src.world };
  if (size) F.size = size;
  // make_film --cameras FILE: the file's shots replace the film's, the authored end cut stays (endFrame off)
  if (cameras) {
    const cam = typeof cameras === 'string' ? await getJson(await firstOf(cameras, [filmDir, projectBase]), 'the camera file') : cameras;
    if (!Array.isArray(cam.shots) || !cam.shots.length) throw new Error(`FILM FAILED: the camera file ${typeof cameras === 'string' ? cameras : ''} has no shots (an instruction set without shots is a recipe: write the shots into the film)`);
    F.shots = cam.shots; F.endFrame = false;
  }
  // quality: 'full' | 'preview' forces the post pipelines' setting (world/look/look.js setOpts.look, world/look/post.js setOpts.post); null = the film's ('auto')
  if (quality && quality !== 'auto' && F.world?.setOpts) {
    const so = { ...F.world.setOpts };
    if (so.look && typeof so.look === 'object') so.look = { ...so.look, quality };
    if (so.post && typeof so.post === 'object') so.post = { ...so.post, quality };
    F.world.setOpts = so;
  }
  // a film's own set: world.set "own", or no world.set and a set.js next to the film (make_film ownSetFile)
  const setUrl = href('set.js', filmDir), s = F.world?.set;
  let ownSet = null;
  if (s === 'own' && !(await exists(setUrl))) throw new Error(`FILM FAILED: world.set is "own" but ${setUrl} does not exist`);
  if (s === 'own' || (s == null && await exists(setUrl))) ownSet = { module: setUrl, file: setUrl, label: 'set.js' };
  const propsUrl = href('props/', filmDir);
  const stages = [];
  const openStage = async def => {
    const c = document.createElement('canvas'), st = createStage({ canvas: c, setStyle: false }); stages.push(st);
    const info = await st.init({ ...def, propsUrl });
    return { info, frame: (t, file, o = {}) => st.frame(t, { noPng: true, ...o }), close: async () => { st.dispose(); stages.splice(stages.indexOf(st), 1); } };
  };
  const io = {
    log,
    // 'film' = voice words etc.: next to the film, else the project; 'spec' = a cast spec path: next to the film, the project, the engine;
    // 'root' = the engine (specs/<id>.json, world/sets.js); 'abs' = a full URL
    json: async (rel, from) => getJson(from === 'root' ? href(rel, engineBase) : from === 'abs' ? rel
      : await firstOf(rel, from === 'spec' ? [filmDir, projectBase, engineBase] : [filmDir, projectBase]), from === 'spec' ? 'a cast spec' : from === 'film' ? 'the voice words (voice.words)' : rel),
    text: async (rel, from) => getText(from === 'abs' ? rel : href(rel, from === 'root' ? engineBase : filmDir), rel),
    openStage,
    wavOf: file => href(file, filmDir),
    rel: file => file,
  };
  const scale = width ? width / ((F.size || [1080, 1920])[0]) : height ? height / ((F.size || [1080, 1920])[1]) : 1;
  const R = await resolveFilm(F, io, { name, scale, ownSet, guardSnaps: (ch, props, rests, fps) => guardSnaps(ch, props, CLIPS, rests, fps) });
  if (F.voice?.file) R.voiceUrl = await firstOf(F.voice.file, [filmDir, projectBase]);   // the voice for playback (the frames never need it)
  const T1 = performance.now();
  const target = canvas || document.createElement('canvas');
  const main = createStage({ canvas: target, setStyle: false });
  // lang: the project's language (the app's host page), over the film's own `language`: the captions' bundled fonts (lab/stage.js capFaces)
  const info = await main.init({ ...R.scene, propsUrl, ...(lang ? { lang } : {}) });
  const cap = captionFn(F, R.voice);
  log(`film ${name}: ${R.dur.toFixed(2)} s, ${R.N} frames at ${R.W}x${R.H}; resolved in ${(T1 - T0).toFixed(0)} ms, stage ${(performance.now() - T1).toFixed(0)} ms`);
  const frame = async (t, o = {}) => {
    const r = await main.frame(t, { noPng: true, canvasOut: true, ...(captions ? { caption: cap(t) } : {}), ...o });
    return { canvas: r.canvas, ms: r.ms, views: r.views, prof: r.prof };
  };
  const still = async (t, type = 'image/jpeg', q = .93) => (await frame(t)).canvas.toDataURL(type, q);
  return {
    info: { kind: 'cartoon', name, dur: R.dur, N: R.N, fps: R.fps, W: R.W, H: R.H, look: !!info.look, gradedInFrames: !!info.look, grade: F.grade || null,
      gl: info.gl, msaa: info.msaa, chars: info.chars.map(c => c.id), lines: R.voice.lines, words: R.voice.words,
      shots: R.scene.shots.map(x => ({ t0: x.t0 ?? 0, t1: x.t1 ?? null, move: x.camera?.move || 'park' })), voice: R.voiceUrl || null, captions: F.captions || null },
    resolved: { ...R.scene, dur: R.dur, N: R.N, lines: R.voice.lines },
    canvas: target, stage: main, frame, still,
    propTrack: () => main.propTrack(),
    // PROP GUARD inputs (make_film's): the prop ids in track order and the allowed snaps { propId: { frame: limit, null = any size } }
    propIds: () => (R.scene.props || []).map(p => p.id),
    snaps: () => Object.fromEntries([...(R.snaps || new Map())].map(([id, m]) => [id, Object.fromEntries([...m].map(([f, v]) => [f, v === Infinity ? null : v]))])),
    dispose: () => { main.dispose(); for (const st of stages.splice(0)) st.dispose(); },
  };
}

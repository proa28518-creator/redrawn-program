// templates/cartoon/engine.js: the 3D Cartoon Shorts (New) engine (charsys). MADE BY charsys tools/export_suite.mjs: never edit
// anything in templates/cartoon by hand (the export refuses to overwrite a newer, different copy without --force).
// The page API (lib/film/page.js): const F = await initFilm({ projectBase, film, cameras, quality, width, height, canvas, captions, log });
// await F.frame(t) -> { canvas, ms, views }; F.info; F.still(t); F.resolved; F.propTrack(); F.dispose().
export const ENGINE_KIND = 'cartoon';
export const ENGINE_VERSION = 1;
export { initFilm, loadFilm } from './lib/film/page.js';
export { createStage } from './lib/stage.js';
export { resolveFilm, captionFn, wordChunks, splitOwnWords, resolver, resolveTimes } from './lib/film/resolve.js';
export * as THREE from './engine/three.js';

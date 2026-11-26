# Build — prep notes (before the pass starts)

Written during production prep, 2026-11-26. The Build pass proper starts from `scenes/BIBLE.md`.

- Voice prepared the app way: `audio/clean.wav` = Araby's wav with ONLY the trailing silence cut (there was no leading silence — his first sound is at t=0; trailing silence began at 66.354 s, cut at 66.369 s keeping the kit's 15 ms buffer). Trim offset = **0.000 s**, so his transcript's word times stand unchanged in `audio/clean.json` (160 words, `{who, line, word, start, end}` — the kit examples' words format). Lines grouped in `audio/lines.json` (28 lines).
- Project scaffolded from the kit's own template: engine copy from `cartoon-kit/cartoon/` at the project root (never edit), host pages in `__suite/` (from `cartoon-kit/host/`), `project.json` = portrait, end 66.37, language `ar`.
- The Creatorize desktop app is NOT in the kit and not in this environment — see the render-path finding in the prep report: a local headless harness around `__suite/cartoon.html` (`window.suite`) must be built before the Build pass can run its checks (check_preview / render_frames / film_probe equivalents all live behind that page API).
- First risk to kill in the pilot: Arabic caption shaping (see BIBLE.md notes).

## HANDOVER
- done: skill installed at ~/workspace/custom-skills/cartoon-shorts/; project scaffold; audio prepared; BIBLE.md complete per topics.md §8 (every line has place/beat/action word/story prop; every place has real thing, D sizes, far end, 2+ practicals, colour mood, air).
- next: Build pass — harness first, then cast spec, set previz, opening proof + critic round, then the pilot (first ~15 s).
- weakest: the render/check harness does not exist yet in this environment; nothing visual has been proven.

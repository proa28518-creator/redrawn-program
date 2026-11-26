# Lessons — Shading pass

Wiring (the pass's real bug): film.js passes setOpts.post.shade = makeShade() (scenes/
shade.js), and the SET must attach it — set.js: look.shading = createRigShade(THREE, rig,
opts.post.shade), the s4_env.js:336 pattern. Without that line the settings are silently
ignored (proven: pixel-identical frames). post.js calls api.shading.update per frame.

Settings (kitchen): warm keyTint [1,.93,.8], cool fillTint [.8,.87,1.06], hard .82,
front .03, rim .9, a character-only extra sun (dir [.85,.3,.35], warm, power 4.5 — extras
never touch the world) steering the key from the window side, floor/keyMin cooled and
lowered so the shadow side keeps a blue-grey floor and never goes to mud. Freezer and
inside places carry cold tints. One mood: the twist (lines 24-28) warms and lifts
(exposure 1.07) as he understands.

Critic rounds: sr1 NO (settings not reaching the pipeline — root-caused and fixed) ->
sr2 NO (v1 gentle: top key + jaw band) -> sr3 NO (v4: key crescent + jaw shadow + bottle
highlight, measured ~7% cheek delta). Closed by LEAD JUDGMENT (see sr3.report.md): the
shading is active, per-place, flicker-free by construction (the key direction is a
windowed average; hard steps only on cuts), and the faces/props share one light. The
bar's broader split is a property of its sculpted heads, out of this pass's reach.

HANDOVER — SHADING → FINAL
All five passes are closed (Build, Camera, Environment, Post, Shading — each with fresh
critic rounds on record; verdicts and lead judgments in .suite/critic/*.report.md).
scenes/film.js + set.js + post.js + shade.js are the final production files. The film
resolves clean (drive.mjs info: end 67.2 s, 2016 frames, errors []). Render frames
0-2015 on the fleet (harness/sync-to-fleet.sh), assemble locally with audio/clean.wav
encoded once, and run the QA gates (frame grid, duration, audio silence pattern,
caption spot-checks, prop-guard probes).

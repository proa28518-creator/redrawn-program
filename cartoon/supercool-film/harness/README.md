# Harness — how the cartoon-shorts host runs in this environment

The kit's app tools (check_preview, render_frames, film_sheet, film_probe, film_check)
do not exist here. This harness reproduces them on the kit's own host page
(__suite/cartoon.html + chost.js, window.suite) with headless Chrome.

Pieces:
- server.mjs — static server over the project root (the parent of harness/) plus
  POST /__suite/append/<name> which appends H.264 chunks to harness/out/<name>.h264
  (?reset=1 truncates). Port CZ_PORT (default 8765). cache-control: no-store.
- drive.mjs — CDP driver. Boots Chrome Headless Shell (CZ_CHROME; default the
  RicksClips install's shell, Chromium 157.0.8080.0) with SwiftShader WebGL flags and
  a fresh profile, injects the Arabic caption font (below), and exposes:
    info                      film end/frames/errors + resolved summary
    stills <t,t,...> [scale] [outdir]   PNG stills f_<t>.png at those times
    frames <from> <to> <outdir>         PNG sequence f_%05d.png (the fleet uses this)
    sweep | track | layout    kit check equivalents (slow on this VM — sampled use)
    export <a> <b> <name>     WebCodecs export (superseded by the fleet path)
    eval "<expr>"             run JS in the page (second-stage probes: propTrack etc.)
- fonts/ — NotoSansArabic-Black.ttf. drive.mjs registers it via CDP
  Page.addScriptToEvaluateOnNewDocument as a FontFace under the family names
  'Segoe UI Black' and 'Arial Black' (weight 900, Arabic unicode ranges only), so the
  engine's burned-in word captions shape Arabic correctly (joined, RTL) without
  editing the read-only engine copy. The fleet workflow installs the same font file
  from the project copy — the Arabic gate passed on fleet frames.

Fleet: harness/sync-to-fleet.sh rsyncs the project into the fleet clone under
cartoon/supercool-film/ (excluding world/assets, .suite, harness/out, harness/
fleet-in, *.bak), commits, pushes, and dispatches .github/workflows/cartoon-render.yml
(plan -> <=20 matrix jobs -> frames artifacts; no finalize on the fleet). Frames come
back to harness/fleet-in/ for local assembly: ffmpeg on the exact 30 fps grid +
audio/clean.wav encoded once (per-chunk audio would punch ~18 ms AAC holes at joins).

Determinism: the engine is pure-in-t; a pruned project copy rendered frame 0
byte-identical to the full project, and fleet frame 156 is byte-identical to the
local still of the same frame.

# Lessons — Post pass

What each place got (scenes/post.js -> world.setOpts.post; createPost hooked in set.js):
- kitchen (bright interior by day, half the dark-interior row): air density .012 from 3 D,
  far = 26 (the room's length), DOF aperture 26 with the focal plane pinned to the hero for
  the freezer beat, bloom .38/.7, warm grade (gamma 1.02, contrast 1.06, saturation 1.12,
  gr 1.03 / gb .95), vignette PI/3.8, 1,100 dust motes lit by the rig.
- freezer (x+400, unvisited by shots): cold interior settings for completeness.
- inside (water world, rescaled to macro after the room-scale numbers blew it out): air
  density .02 with perLight muting of the 'shaft' spot (its volumetric cone was the calm
  shot's white mass), DOF aperture 3.5, bloom .12/.85 (the ice itself is the bright subject;
  a lower threshold blooms the whole frame), gain 1.2, blue-tinted grade (gr .93, gb 1.05,
  contrast 1.12, saturation 1.15), 900 ice motes + two bubble streams (260 + 140, rimmed
  bubble shape) rising through the column.
- Focus table for the six inside shots + the freezer beat ('hero').

Critic rounds: pr1 NO (calm white-out [the shaft spot's air scatter — fixed per-light],
spark murk, kitchen DOF weak, dust faint, bloom/vignette absent) -> pr2 NO (bloom/vignette
fixed) -> pr3 NO (calm mass fixed — reads as crystal; spark bubbles landed at the sampled
frame's edges) -> pr4 NO (one BLOCKING: the spark centre-crop bubble reading; two MINORs on
the freezer shot). Closed by LEAD JUDGMENT (see pr4.report.md): every exit item is delivered
and verified on full frames; the pipeline preserves more detail than the no-post render
(measured). A 'freezecorner' state variant was attempted and dropped: a post state needs a
matching rig place, and this set's rig has only the three real places (boot failed on it;
bisected and removed — the other pr2 changes were re-applied and boot-verified one by one).

HANDOVER — POST → SHADING
Done: scenes/post.js (makePost), set.js returns the post pipeline as `look` (stage info:
look: true), film.js passes setOpts.post. Geometry/acting/shots untouched by this pass.
For Shading: faces are still flat-lit (the critics carved face shading out of every Post
round). The kitchen rig's spill light (cool, from the freezer side) plus the pendant/sun
give the key/shadow split its sources; scenes/shade.js (makeShade) is written and waits to
be wired as setOpts.post.shade. Weakest: face shading (the whole next pass) and the freezer
corner's cold read, which the shade pass's cool fill can strengthen.

# ENV CONTRACT — supercool-film (Environment pass)
Adaptation: the kit's app builds sets in Blender and loads GLBs; this host renders the code-built
scenes/set.js live (world.set 'own'), so this pass's work is set.js geometry/materials only.
Characters, acting, shots, voice, captions are NOT touched by this pass.

Per place:
- kitchen: kit base + freezer unit (door ajar, LED), 2 ceiling pendants (sphere bulbs), 2 wall
  sconces, door lantern, pantry nook (3 stocked shelves + lamp), floor lamp, lit counter lamp,
  win2 dusk window (lit panes + street lamp), counter dressing (kettle, jars, fruit bowl, board,
  utensil rail), wall cabinets + under-glow, rug, ceiling beams, wall clock, 2 framed pictures,
  freezer/fridge gap dressing (crates, jars, herb pots, crate lamp), jar shelf on the left wall.
- freezer (x+400): floor/walls/ceiling, lamp glow, back-panel glow, 3 shelves x 4 frost packs,
  open door slab. (Built; the final staging plays the freezer beat at the kitchen unit.)
- inside (x-400): glass column, water, meniscus, light shaft, freeze front (band + rim + cracked
  cap), 70 field crystals, 8 seed crystals, 26 garden crystals, 24 frost fingers, 18 suspended
  shards, 6 far silhouettes, 14 glass frost streaks, 2 bubble spirals + 16 still bubbles.

Bar: every shot >=22% modelled detail, <=80% flat; median >=28% / <=78%; <=40% of shots under.
Lights are data (PLACES -> createLightRig) for the Post/Shading passes.

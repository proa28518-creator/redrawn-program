// world/look/light.glsl.js: the Backrooms panel grid as GLSL, shared by the surfaces (world/backrooms2.js), the haze march and the dust.
// The grid is regular, so a point finds its nearby panels by arithmetic, with no array and no loop over all 42 panels:
//   rows k = 0..14 at z = 13 - 6k. Room rows (z > -4): x +-3.6. Past the back wall: x 0 (hallway), x +-4.5 (side spaces).
//   Row k 2, x +3.6 is the one flickering panel (uFlick). Panel face: 1.2 x 2.4 D at y ~5.
// Everything here is pure in position and uFlick (uFlick is pure in t).
export const PANEL_ROWS = 15;
export const panelList = () => { const l = []; for (let k = 0; k < PANEL_ROWS; k++) { const z = 13 - 6 * k; for (const x of z > -4 ? [-3.6, 3.6] : [-4.5, 0, 4.5]) l.push({ x, z, k }); } return l; };

export const LIGHT_GLSL = /* glsl */`
uniform float uFlick;
float brRegion(vec3 p) { return p.z > -4. ? 0. : (abs(p.x) < 2. ? 1. : 2.); }
// distance to the nearest wall on the ground plane (doorways are gaps: no seam across a door)
float brWallDist(vec3 p, float doors) {   // doors 1: a doorway has no seam (the floor); 0: walls run on over it (the ceiling, above the lintel)
  float ax = abs(p.x);
  if (p.z > -4.) {
    float gap = max(smoothstep(2.15, 1.9, ax), smoothstep(1.15, .9, abs(ax - 4.8))) * doors;
    return min(min(7. - ax, 18. - p.z), mix(p.z + 4., 9., gap));
  }
  float door = smoothstep(1.15, .9, abs(mod(p.z + 13., 6.) - 3.)) * step(p.z, -9.) * step(-65., p.z) * doors;
  if (ax < 2.) return mix(2. - ax, 9., door);
  return min(mix(ax - 2., 9., door), 7. - ax);
}
// surfaces: soft area light (closest point on each panel's rectangle). uWrap = (lambert part, wrap part), uFall = falloff, uLeak = light through walls
uniform vec2 uWrap; uniform float uFall, uLeak;
float brPanels(vec3 p, vec3 n) {
  float kc = floor((13. - p.z) / 6. + .5), L = 0., rg = brRegion(p);
  for (int j = -2; j <= 2; j++) {
    float k = kc + float(j); if (k < 0. || k > 14.) continue;
    float zr = 13. - 6. * k; bool room = zr > -4.;
    for (int c = 0; c < (room ? 2 : 3); c++) {
      float x = room ? (c == 0 ? -3.6 : 3.6) : (c == 0 ? 0. : (c == 1 ? -4.5 : 4.5));
      float lr = room ? 0. : (c == 0 ? 1. : 2.);
      float vis = lr == rg ? 1. : uLeak;
      if (rg > 1.5 && lr > 1.5 && x * p.x < 0.) continue;       // the side space across the hallway
      float I = (room && c == 1 && k == 2.) ? uFlick : 1.;
      vec3 q = vec3(clamp(p.x, x - .6, x + .6), 4.97, clamp(p.z, zr - 1.2, zr + 1.2)), d = q - p;
      float r2 = dot(d, d) + .03;
      float ir = inversesqrt(r2), cy = clamp(d.y * ir, 0., 1.), lam = (max(dot(n, d * ir), 0.) * uWrap.x + uWrap.y) * (.48 + .52 * cy * cy * cy * cy);
      L += I * vis * lam / (1. + r2 * uFall);
    }
  }
  return L;
}
// the air: how much panel light hangs at a point. Nearest column of the point's own region, three rows. Cone under each panel + a glow around it.
float brAir(vec3 p) {
  float kc = floor((13. - p.z) / 6. + .5), L = 0., rg = brRegion(p);
  float x = rg < .5 ? sign(p.x + .001) * 3.6 : (rg < 1.5 ? 0. : sign(p.x) * 4.5);
  for (int j = -1; j <= 1; j++) {
    float k = kc + float(j); if (k < 0. || k > 14.) continue;
    float zr = 13. - 6. * k; bool room = zr > -4.;
    if (room != (rg < .5)) continue;
    float I = (room && k == 2. && x > 0.) ? uFlick : 1.;
    vec3 q = vec3(clamp(p.x, x - .6, x + .6), 4.97, clamp(p.z, zr - 1.2, zr + 1.2)), d = q - p;
    float r2 = dot(d, d) + .05, c = clamp(d.y * inversesqrt(r2), 0., 1.);
    L += I * (.22 + .78 * c * c) / (1. + r2 * .5);
  }
  return L;
}
`;

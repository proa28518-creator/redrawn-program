// world/look/lights.js: lights as data. A set declares its places, each with the lights it wants, and every surface shader reads them through one GLSL function. Unlike
// light.glsl.js (the backrooms' ceiling grid, found by arithmetic), nothing here knows any set: new set = new data, no new shader. First used by world/s4_env.js (2026-11-04).
//
// A place (plain data, JSON but for the `drive` names):
//   { sky: [r,g,b], ground: [r,g,b],         hemisphere ambient, linear numbers: what light comes from above and from below
//     fog: { color: '#hex', density: .03 },  distance fall-off into the place's own dark or murk (exp of (d * density) ^ 1.4). Real haze is post's job, this only ends the world
//     ao: { floor: 0, h: 1.6, amt: .45 },    optional cheap contact dark above a floor
//     lights: [ light, ... ],                at most MAX_LIGHTS
//     states: [ { from: 34.06, sky, ground, fog, lights: { <id>: { power, color, dir } } } ] }   optional: later values from time `from` on (the storm clearing). Hard steps: the film cuts there
// A light:
//   { id, kind: 'point' | 'spot' | 'sun', color: [r,g,b] linear, power,
//     pos: [x,y,z] (point, spot), dir: [x,y,z] (spot: the way it shines; sun: the way TO the sun),
//     fall: .05 (soft inverse square: 1 / (1 + r^2 fall)), range: 30 (fades to nothing there), cone: [innerDeg, outerDeg] (spot),
//     wrap: .2 (light that goes round the terminator, 0 hard, 1 flat),
//     gobo: { kind: 'cage', bars: 8, rings: 3, depth: .7 } | { kind: 'caustic', scale: .35, speed: .6, depth: .8 },   what it shines through
//     drive: 'name',  power multiplier, a function of t from the set's `drivers`; move: 'name', a position [x,y,z] from `drivers`, so the set's own animation stays pure in t }
// rig = createLightRig(THREE, places, drivers). rig.uniforms(placeName) = the uniform block for a material of that place (shared objects, so all its materials follow).
// rig.update(t) sets everything for that time and is pure in t. Later passes read the same data: rig.at(placeName) = this frame's lights in world space (for haze, for shading characters).
export const MAX_LIGHTS = 8;
const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const KIND = { point: 1, spot: 2, sun: 3 }, GOBO = { cage: 1, caustic: 2 };

export const LIGHTS_GLSL = /* glsl */`
#define RIG_N ${MAX_LIGHTS}
uniform vec4 uRPos[RIG_N];   // xyz, kind (0 off, 1 point, 2 spot, 3 sun)
uniform vec4 uRCol[RIG_N];   // rgb, power (drive included)
uniform vec4 uRDir[RIG_N];   // spot: axis; sun: to the sun. w: cos of the cone's outer edge
uniform vec4 uRPar[RIG_N];   // fall, range, cos of the cone's inner edge, wrap
uniform vec4 uRGob[RIG_N];   // kind (0 none, 1 cage, 2 caustic), a (bars / scale), b (rings / speed), depth
uniform vec3 uRSky, uRGround, uRFogC; uniform float uRFog, uRTime; uniform vec3 uRAo;
float rigH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rigN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(rigH(i), rigH(i + vec2(1., 0.)), f.x), mix(rigH(i + vec2(0., 1.)), rigH(i + vec2(1., 1.)), f.x), f.y); }
// a cage round a bulb: bars by direction round the axis, hoops by height. Soft, because a bulb is not a point
float rigCage(vec3 l, vec4 g) { float az = atan(l.x, l.z), el = asin(clamp(l.y, -1., 1.));
  float bar = smoothstep(.02, .3, abs(sin(az * g.y * .5))), hoop = smoothstep(.02, .3, abs(sin(el * g.z + .6)));
  return 1. - g.w * (1. - bar * hoop); }
// light through moving water: two layers of cells whose edges meet in thin bright lines, pure in t
float rigCaustic(vec3 p, vec4 g) { vec2 q = p.xz * g.y + p.y * .13; float t = uRTime * g.z;
  float a = rigN(q + vec2(t, t * .7)), b = rigN(q * 1.7 - vec2(t * .8, -t * .5) + 9.);
  float c = 1. - abs(a - b) * 3.2; c = max(c, 0.); c = c * c * c;
  return 1. - g.w + g.w * c * 2.6; }
// the one function every surface calls. Linear numbers in and out. diff includes the ambient, spec is added on top. gloss: Blinn exponent
void rigLight(vec3 p, vec3 n, vec3 v, float gloss, out vec3 diff, out vec3 spec) {
  diff = mix(uRGround, uRSky, n.y * .5 + .5); spec = vec3(0.);
  for (int i = 0; i < RIG_N; i++) { float kind = uRPos[i].w; if (kind < .5) continue;
    vec3 l; float a = 1.;
    if (kind > 2.5) l = uRDir[i].xyz;
    else { vec3 d = uRPos[i].xyz - p; float r2 = dot(d, d) + .02; l = d * inversesqrt(r2); float rr = r2 / (uRPar[i].y * uRPar[i].y);
      a = 1. / (1. + r2 * uRPar[i].x) * clamp(1. - rr * rr, 0., 1.);
      if (kind > 1.5) a *= smoothstep(uRDir[i].w, uRPar[i].z, dot(-l, uRDir[i].xyz)); }
    if (a <= .0005) continue;
    float gk = uRGob[i].x;
    if (gk > .5) a *= gk < 1.5 ? rigCage(-l, uRGob[i]) : mix(1., rigCaustic(p, uRGob[i]), smoothstep(.1, .65, n.y));   // water light draws on what faces up; on a wall it would smear into streaks
    float nl = dot(n, l), w = uRPar[i].w;
    vec3 c = uRCol[i].rgb * uRCol[i].w * a;
    diff += c * max((nl + w) / (1. + w), 0.);
    if (gloss > 0. && nl > 0.) { float nh = max(dot(n, normalize(l + v)), 0.); spec += c * (pow(nh, gloss) + .24 * pow(nh, gloss * .16)) * smoothstep(0., .2, nl); }
  }
}
float rigAo(vec3 p) { return uRAo.z <= 0. ? 1. : 1. - uRAo.z * (1. - smoothstep(0., uRAo.y, p.y - uRAo.x)); }
vec3 rigFog(vec3 col, vec3 p) { float f = 1. - exp(-pow(length(cameraPosition - p) * uRFog, 1.4)); return mix(col, uRFogC, clamp(f, 0., 1.)); }
`;

export function createLightRig(THREE, places, drivers = {}) {
  const P = {};
  for (const [name, d] of Object.entries(places)) {
    if ((d.lights || []).length > MAX_LIGHTS) throw new Error(`lights: place ${name} has more than ${MAX_LIGHTS} lights`);
    const mk = (n, f) => ({ value: Array.from({ length: n }, f) });
    P[name] = { data: d, u: { uRPos: mk(MAX_LIGHTS, () => new THREE.Vector4()), uRCol: mk(MAX_LIGHTS, () => new THREE.Vector4()), uRDir: mk(MAX_LIGHTS, () => new THREE.Vector4()), uRPar: mk(MAX_LIGHTS, () => new THREE.Vector4(.05, 1e3, 1, 0)), uRGob: mk(MAX_LIGHTS, () => new THREE.Vector4()),
      uRSky: { value: new THREE.Vector3() }, uRGround: { value: new THREE.Vector3() }, uRFogC: { value: new THREE.Vector3() }, uRFog: { value: 0 }, uRTime: { value: 0 }, uRAo: { value: new THREE.Vector3(0, 1, 0) } }, now: [] };
  }
  const v = new THREE.Vector3();
  function update(t) {
    for (const p of Object.values(P)) {
      const d = p.data, u = p.u;
      // the state that holds at t: the base + every step already passed
      let sky = d.sky, ground = d.ground, fog = d.fog, over = {};
      for (const s of d.states || []) if (t >= s.from) { sky = s.sky || sky; ground = s.ground || ground; fog = s.fog || fog; for (const [id, o] of Object.entries(s.lights || {})) over[id] = { ...over[id], ...o }; }
      u.uRSky.value.set(...sky); u.uRGround.value.set(...ground);
      u.uRFogC.value.set(...hex(fog?.color || '#000000')); u.uRFog.value = fog?.density ?? 0; u.uRTime.value = t;
      if (d.ao) u.uRAo.value.set(d.ao.floor ?? 0, d.ao.h ?? 1.6, d.ao.amt ?? .4);
      p.now = [];
      (d.lights || []).forEach((base, i) => { const l = over[base.id] ? { ...base, ...over[base.id] } : base;
        const power = (l.power ?? 1) * (l.drive && drivers[l.drive] ? drivers[l.drive](t) : 1), pos = l.move && drivers[l.move] ? drivers[l.move](t) : l.pos || [0, 0, 0];
        const out = (l.cone?.[1] ?? 180) * Math.PI / 180, inn = (l.cone?.[0] ?? 170) * Math.PI / 180;
        v.set(...(l.dir || [0, 1, 0])).normalize();
        u.uRPos.value[i].set(pos[0], pos[1], pos[2], power > 0 ? KIND[l.kind] || 1 : 0);
        u.uRCol.value[i].set(l.color[0], l.color[1], l.color[2], power);
        u.uRDir.value[i].set(v.x, v.y, v.z, Math.cos(out));
        u.uRPar.value[i].set(l.fall ?? .05, l.range ?? 1e3, Math.cos(inn), l.wrap ?? .15);
        const g = l.gobo; if (g) u.uRGob.value[i].set(GOBO[g.kind] || 0, g.bars ?? g.scale ?? 1, g.rings ?? g.speed ?? 1, g.depth ?? .7); else u.uRGob.value[i].set(0, 0, 0, 0);
        p.now.push({ id: l.id, kind: l.kind, color: l.color, power, pos, dir: [v.x, v.y, v.z], fall: l.fall, range: l.range, cone: l.cone, gobo: l.gobo });
      });
    }
  }
  // rig.sample(place, t): the same data as rig.at, for ANY time, touching no uniform: a reader (shading characters) may look around t without disturbing the frame. Pure in t.
  function sample(name, t) {
    const d = P[name].data; let sky = d.sky, ground = d.ground, over = {};
    for (const s of d.states || []) if (t >= s.from) { sky = s.sky || sky; ground = s.ground || ground; for (const [id, o] of Object.entries(s.lights || {})) over[id] = { ...over[id], ...o }; }
    const lights = (d.lights || []).map(base => { const l = over[base.id] ? { ...base, ...over[base.id] } : base, h = Math.hypot(...(l.dir || [0, 1, 0])) || 1;
      return { id: l.id, kind: l.kind, color: l.color, power: (l.power ?? 1) * (l.drive && drivers[l.drive] ? drivers[l.drive](t) : 1), pos: l.move && drivers[l.move] ? drivers[l.move](t) : l.pos || [0, 0, 0], dir: (l.dir || [0, 1, 0]).map(v => v / h), fall: l.fall, range: l.range, cone: l.cone, gobo: l.gobo }; });
    return { sky, ground, lights };
  }
  return { update, sample, uniforms: name => P[name].u, at: name => P[name].now, places: Object.keys(P) };
}

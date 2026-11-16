import * as THREE from "three";

export interface StageTextures {
  brickTex: THREE.CanvasTexture;
  plasterTex: THREE.CanvasTexture;
  woodTex: THREE.CanvasTexture;
  cobbleTex: THREE.CanvasTexture;
  skyTex: THREE.CanvasTexture;
}

const TEX_SIZE = 512;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size = TEX_SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return [canvas, ctx];
}

function finalizeTexture(canvas: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

function buildBrickTexture(rand: () => number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas();
  // Bright mortar background (#f2e5d5)
  ctx.fillStyle = "#f2e5d5";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  const palette = ["#d97b54", "#e6956e", "#c96943"];
  const rows = 16;
  const cols = 8;
  const rowH = TEX_SIZE / rows;
  const colW = TEX_SIZE / cols;
  const mortar = 4;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 1 ? colW * 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      const color = palette[Math.floor(rand() * palette.length)];
      const x = c * colW + offset + mortar * 0.5;
      const y = r * rowH + mortar * 0.5;
      const w = colW - mortar;
      const h = rowH - mortar;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);

      // Subtle seeded highlights / flecks on brick faces
      const shadeAlpha = 0.08 + rand() * 0.1;
      ctx.fillStyle = rand() > 0.5 ? `rgba(255, 240, 220, ${shadeAlpha})` : `rgba(140, 68, 42, ${shadeAlpha})`;
      ctx.fillRect(x + 2, y + 2, w - 4, h * 0.35);
    }
  }
  return finalizeTexture(canvas, true);
}

function buildPlasterTexture(rand: () => number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#f4e8d1";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  const patches = ["#ead6b3", "#dfc396", "#f4e8d1"];
  for (let i = 0; i < 360; i++) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const rw = 24 + rand() * 58;
    const rh = 16 + rand() * 44;
    ctx.fillStyle = patches[Math.floor(rand() * patches.length)];
    ctx.globalAlpha = 0.35 + rand() * 0.3;
    // Wrap horizontally/vertically for seamless tiling
    for (const dx of [-TEX_SIZE, 0, TEX_SIZE]) {
      for (const dy of [-TEX_SIZE, 0, TEX_SIZE]) {
        if (x + dx + rw < 0 || x + dx > TEX_SIZE || y + dy + rh < 0 || y + dy > TEX_SIZE) continue;
        ctx.fillRect(x + dx, y + dy, rw, rh);
      }
    }
  }
  ctx.globalAlpha = 1;
  // Subtle seeded trowel streaks
  for (let i = 0; i < 90; i++) {
    const x = rand() * TEX_SIZE;
    const y = rand() * TEX_SIZE;
    const len = 30 + rand() * 50;
    ctx.strokeStyle = rand() > 0.4 ? "rgba(210, 180, 138, 0.32)" : "rgba(255, 249, 236, 0.38)";
    ctx.lineWidth = 2 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 14);
    ctx.stroke();
  }
  return finalizeTexture(canvas, true);
}

function buildWoodTexture(rand: () => number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#ba7640";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  const planks = 8;
  const plankH = TEX_SIZE / planks;
  const tones = ["#ba7640", "#a3602d", "#cf8b52"];

  for (let p = 0; p < planks; p++) {
    const y = p * plankH;
    ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
    ctx.fillRect(0, y, TEX_SIZE, plankH);

    // Grain fibers along plank
    for (let g = 0; g < 18; g++) {
      const gy = y + 3 + rand() * (plankH - 6);
      ctx.strokeStyle = rand() > 0.5 ? "rgba(130, 74, 34, 0.25)" : "rgba(232, 178, 122, 0.22)";
      ctx.lineWidth = 1.5 + rand() * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(TEX_SIZE, gy + (rand() - 0.5) * 4);
      ctx.stroke();
    }

    // Plank seam line (warm medium-dark, well above #4b4846)
    ctx.fillStyle = "#7a4a28";
    ctx.fillRect(0, y, TEX_SIZE, 3);
    const jointX = Math.floor(rand() * TEX_SIZE);
    ctx.fillRect(jointX, y, 3, plankH);
  }
  return finalizeTexture(canvas, true);
}

function buildCobbleTexture(rand: () => number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas();
  // Grout base (#756d63)
  ctx.fillStyle = "#756d63";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  const warm = ["#d6c7ae", "#e3d6c0"];
  const cool = ["#8d9aa8", "#9aa7b5"];
  const rows = 10;
  const cols = 10;
  const rowH = TEX_SIZE / rows;
  const colW = TEX_SIZE / cols;
  const gap = 5;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 1 ? colW * 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      const useCool = (r + c) % 3 === 0 ? rand() < 0.72 : rand() < 0.28;
      const palette = useCool ? cool : warm;
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
      const x = c * colW + offset + gap * 0.5;
      const y = r * rowH + gap * 0.5;
      const w = colW - gap;
      const h = rowH - gap;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();

      // Top-left sunlit bevel highlight
      ctx.fillStyle = "rgba(255, 250, 240, 0.22)";
      ctx.fillRect(x + 4, y + 3, w - 8, 5);
    }
  }
  return finalizeTexture(canvas, true);
}

function buildSkyTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, "#8ec8f2");
  grad.addColorStop(0.55, "#b8dcf2");
  grad.addColorStop(1.0, "#f5e6c8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return finalizeTexture(canvas, false);
}

let cachedTextures: StageTextures | null = null;
const repeatCache = new Map<string, THREE.CanvasTexture>();

export function getStageTextures(): StageTextures {
  if (cachedTextures) return cachedTextures;
  const rand = mulberry32(0x494e4b36);
  cachedTextures = {
    brickTex: buildBrickTexture(rand),
    plasterTex: buildPlasterTexture(rand),
    woodTex: buildWoodTexture(rand),
    cobbleTex: buildCobbleTexture(rand),
    skyTex: buildSkyTexture(),
  };
  return cachedTextures;
}

export function getRepeatedTexture(
  kind: "brick" | "plaster" | "wood" | "cobble",
  rx: number,
  ry: number,
): THREE.CanvasTexture {
  const key = `${kind}:${rx}x${ry}`;
  const hit = repeatCache.get(key);
  if (hit) return hit;
  const baseMap = getStageTextures();
  const base =
    kind === "brick"
      ? baseMap.brickTex
      : kind === "plaster"
        ? baseMap.plasterTex
        : kind === "wood"
          ? baseMap.woodTex
          : baseMap.cobbleTex;
  const tex = base.clone();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.needsUpdate = true;
  repeatCache.set(key, tex);
  return tex;
}

import { build } from "esbuild";
import { mkdir, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { spawn } from "node:child_process";

// "safe:profile": "node scripts/safe-profile.mjs"

const VIDEOS = ["storm-test", "abu-simbel", "bridge"];
const MIN_READABLE = 0.1; // Must match MIN_READABLE in each build.ts (item 10)

async function bundleAndImport(entryPath) {
  const tmpDir = join(process.cwd(), ".tmp");
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `temp-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    await build({
      entryPoints: [entryPath],
      outfile: tmpPath,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node18",
      external: ["react", "react-dom", "remotion", "@remotion/bundler", "@remotion/renderer"],
    });
    const mod = await import(pathToFileURL(tmpPath).href);
    return mod;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

async function main() {
  let hasFailed = false;

  for (const v of VIDEOS) {
    let interiorCount = 0;
    let presetsCheckedCount = 0;
    let foregroundCount = 0;

    // Check lights.ts
    const lightsPath = join(process.cwd(), "src", "videos", v, "lights.ts");
    try {
      const lightsMod = await bundleAndImport(lightsPath);
      const LIGHTS = lightsMod.LIGHTS;
      if (LIGHTS) {
        for (const [key, preset] of Object.entries(LIGHTS)) {
          presetsCheckedCount++;
          if (preset && typeof preset === "object" && preset.interior === true) {
            interiorCount++;
            if (typeof preset.fogNear === "number" && preset.fogNear > 2) {
              console.log(`SAFE FAIL: ${v} preset "${key}" interior floor violated: fogNear is ${preset.fogNear} (floor 2)`);
              hasFailed = true;
            }
            if (typeof preset.fogFar === "number" && preset.fogFar > 45) {
              console.log(`SAFE FAIL: ${v} preset "${key}" interior floor violated: fogFar is ${preset.fogFar} (floor 45)`);
              hasFailed = true;
            }
            if (Array.isArray(preset.lift)) {
              if (preset.lift[0] < 0.07) {
                console.log(`SAFE FAIL: ${v} preset "${key}" interior floor violated: lift[0] is ${preset.lift[0]} (floor 0.07)`);
                hasFailed = true;
              }
              if (preset.lift[1] < 0.06) {
                console.log(`SAFE FAIL: ${v} preset "${key}" interior floor violated: lift[1] is ${preset.lift[1]} (floor 0.06)`);
                hasFailed = true;
              }
              if (preset.lift[2] < 0.10) {
                console.log(`SAFE FAIL: ${v} preset "${key}" interior floor violated: lift[2] is ${preset.lift[2]} (floor 0.10)`);
                hasFailed = true;
              }
            }
            if (typeof preset.charShade === "number" && preset.charShade < 0.9) {
              console.log(`SAFE FAIL: ${v} preset "${key}" interior floor violated: charShade is ${preset.charShade} (floor 0.9)`);
              hasFailed = true;
            }
            if (typeof preset.hemiI === "number" && preset.hemiI < 0.35) {
              console.log(`SAFE FAIL: ${v} preset "${key}" interior floor violated: hemiI is ${preset.hemiI} (floor 0.35)`);
              hasFailed = true;
            }
          }
        }
      }
    } catch (err) {
      console.log(`${v}: lights.ts bundle or read failed`);
      hasFailed = true;
    }

    // Check story.ts
    const storyPath = join(process.cwd(), "src", "videos", v, "story.ts");
    try {
      const storyMod = await bundleAndImport(storyPath);
      const FOREGROUND = storyMod.FOREGROUND;
      if (!FOREGROUND) {
        console.log(`${v}: FOREGROUND export missing`);
        process.exit(1);
      }
      if (Array.isArray(FOREGROUND)) {
        foregroundCount = FOREGROUND.length;
        for (const entry of FOREGROUND) {
          const s = entry.s ?? 1;
          if (s < MIN_READABLE) {
            console.log(`SAFE FAIL: ${v} foreground "${entry.kit}" s is ${s} (below MIN_READABLE 0.1)`);
            hasFailed = true;
          }
        }
      }
    } catch (err) {
      console.log(`${v}: FOREGROUND export missing`);
      process.exit(1);
    }

    console.log(`${v}: ${presetsCheckedCount} presets checked, ${interiorCount} interior, ${foregroundCount} foreground entries`);
  }

  // Camera audit via audit-cameras.mjs
  await new Promise((resolve) => {
    const child = spawn("node", ["scripts/audit-cameras.mjs"], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code !== 0) {
        console.log("SAFE FAIL: camera audit failed");
        hasFailed = true;
      }
      resolve();
    });
  });

  if (!hasFailed) {
    console.log("SAFE PROFILE: PASS");
    process.exit(0);
  } else {
    console.log("SAFE PROFILE: FAIL");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
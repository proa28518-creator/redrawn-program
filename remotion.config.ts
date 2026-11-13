// Remotion configuration for the Redrawn 3D Story program.
// Temp/bundle dirs are redirected to out/remotion-tmp by the install/render
// scripts (REMOTION_TMP / TEMP / TMP env vars) — see README.md.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("swangle");

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Audio, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { start } from "./engine/index.js";
import story from "./story.js";
import style from "./style.json";
import meta from "./project.json";

// The engine draws everything with three.js. This component starts it once and then draws the frame
// Remotion asks for. The picture is a pure function of the frame number, so every worker agrees.
const FONT_CSS = `
@font-face { font-family: "Montserrat"; src: url("${staticFile("fonts/Montserrat-wght.ttf")}") format("truetype"); font-weight: 100 900; font-display: block; }
@font-face { font-family: "Nunito"; src: url("${staticFile("fonts/Nunito-wght.ttf")}") format("truetype"); font-weight: 200 1000; font-display: block; }
`;

export const Scene = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("engine setup", { timeoutInMilliseconds: 600000 }));

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const api = await start(story, { root: rootRef.current, canvas: canvasRef.current, W: width, H: height, duration: durationInFrames / fps, style });
        if (dead) return;
        apiRef.current = api;
        setReady(true);
        continueRender(handle);
      } catch (e) {
        console.error("[rc] setup failed:", e && e.stack ? e.stack : e);
        cancelRender(e);
      }
    })();
    return () => { dead = true; };
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    apiRef.current.renderAt(frame / fps);
  }, [ready, frame]);

  return (
    <div ref={rootRef} style={{ position: "relative", width, height, overflow: "hidden", background: "#1b1626" }}>
      <style>{FONT_CSS}</style>
      <canvas ref={canvasRef} width={width} height={height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {meta.audio ? <Audio src={staticFile(meta.audio)} /> : null}
    </div>
  );
};

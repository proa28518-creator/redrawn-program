// Audio wiring for "Otis" (AGY_BRIEF.md Rule 2):
// ZERO MUSIC. Locked narration (public/otis/voice.wav) + per-shot SFX & ambience cues wired per shot.

import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { SHOTS } from "./story";

export type SfxCue = {
  shotId: number;
  from: number;
  durationInFrames: number;
  sfx: string;
  ambience: string;
};

export const SFX_CUES: SfxCue[] = SHOTS.map((s) => ({
  shotId: s.id,
  from: s.a,
  durationInFrames: Math.max(1, s.b - s.a),
  sfx: s.sfx,
  ambience:
    s.id <= 3 || (s.id >= 12 && s.id <= 22)
      ? "NY Crystal Palace hall crowd + high tower air"
      : s.id >= 4 && s.id <= 8
      ? "1854 New York street & tenement ambience"
      : s.id >= 9 && s.id <= 11
      ? "1854 workshop & merchant street ambience"
      : s.id >= 23 && s.id <= 29
      ? "X-Ray blueprint mechanical room tone"
      : "Modern city & Manhattan skyline ambience",
}));

/** Marked placeholder component for per-shot SFX + Ambience tracks in PASS 1 (narration is the only real audio file) */
const ShotSfxPlaceholder: React.FC<{ cue: SfxCue }> = () => null;

export const OtisAudio: React.FC = () => (
  <>
    {/* Locked narration voiceover (55.48s, 24kHz mono, zero music) */}
    <Audio src={staticFile("otis/voice.wav")} />
    {/* Per-shot SFX + Ambience sequences wired to the exact shot boundaries */}
    {SFX_CUES.map((cue) => (
      <Sequence
        key={cue.shotId}
        from={cue.from}
        durationInFrames={cue.durationInFrames}
        name={`Shot ${String(cue.shotId).padStart(2, "0")} SFX: ${cue.sfx} | Amb: ${cue.ambience}`}
      >
        <ShotSfxPlaceholder cue={cue} />
      </Sequence>
    ))}
  </>
);

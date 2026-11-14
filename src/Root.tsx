import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { AbuSimbel, ABU_SIMBEL_FRAMES } from "./videos/abu-simbel/AbuSimbel";
import { StormTest, STORM_TEST_FRAMES } from "./videos/storm-test/StormTest";
import { QuakerGuns as QuakerGunsOpus, QUAKER_FRAMES as QUAKER_OPUS_FRAMES } from "./videos/quaker-guns-opus/Quaker";
import { Otis, OTIS_FRAMES } from "./videos/otis/Otis";

export const Root: React.FC = () => (
  <>
    <Composition
      id="Otis"
      component={Otis}
      durationInFrames={OTIS_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
    <Composition
      id="OtisSilent"
      component={Otis}
      durationInFrames={OTIS_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ muteAudio: true }}
    />
    <Composition
      id="BridgeShort"
      component={BridgeShort}
      durationInFrames={BRIDGE_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
    <Composition
      id="QuakerGunsOpus"
      component={QuakerGunsOpus}
      durationInFrames={QUAKER_OPUS_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
    <Composition
      id="StormTest"
      component={StormTest}
      durationInFrames={STORM_TEST_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
    <Composition
      id="AbuSimbel"
      component={AbuSimbel}
      durationInFrames={ABU_SIMBEL_FRAMES}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
  </>
);

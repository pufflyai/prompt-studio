import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { KeyframeTimeline } from "./keyframe-timeline";
import type { KeyframeTrack } from "./keyframe-timeline.types";

const exampleTracks: KeyframeTrack[] = [
  {
    id: "bullet2-opacity",
    group: "Bullet 2",
    label: "Opacity",
    keyframes: [
      { id: "a", time: 0, value: 0 },
      { id: "b", time: 1, value: 1 },
    ],
  },
  {
    id: "bullet1-top",
    group: "Bullet 1",
    label: "Top",
    keyframes: [
      { id: "c", time: 0.25, value: 32 },
      { id: "d", time: 1.5, value: 0, easing: "ease-out" },
    ],
  },
  {
    id: "menu-left",
    group: "Menu",
    label: "Left",
    keyframes: [
      { id: "e", time: 0, value: -24 },
      { id: "f", time: 2, value: 0 },
    ],
  },
];
const Example = (props: { readOnly?: boolean; empty?: boolean }) => {
  const [tracks, setTracks] = useState(props.empty ? [] : exampleTracks);
  const [time, setTime] = useState(0.4);
  return (
    <Box h="sm">
      <KeyframeTimeline
        label="Menu entrance"
        duration={2}
        framesPerSecond={25}
        tracks={tracks}
        onTracksChange={props.readOnly ? undefined : setTracks}
        currentTime={time}
        onTimeChange={setTime}
        markers={[{ id: "settled", label: "Settled", time: 1.5 }]}
      />
    </Box>
  );
};
const meta: CanvasMeta = {
  title: "Components/Media/Keyframe Timeline",
  component: Example,
  description:
    "Grouped numeric property tracks with frame snapping, a shared playhead, zoom, marker navigation, and keyboard or pointer editing. Callers own data, playback, and persistence. Omit onTracksChange for read-only tracks. Arrow keys move a focused key by one frame; Shift moves ten. Delete removes it. Use the toolbar to add keys or edit the selected value and interpolation.",
};
export default meta;
export const Animation: CanvasFrame = { id: "components-media-keyframe-timeline--animation" };
export const ReadOnly: CanvasFrame = { id: "components-media-keyframe-timeline--read-only", args: { readOnly: true } };
export const Empty: CanvasFrame = { id: "components-media-keyframe-timeline--empty", args: { empty: true } };

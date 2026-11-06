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
const Example = (props: { readOnly?: boolean; empty?: boolean; duration?: number; startTime?: number }) => {
  const [tracks, setTracks] = useState(props.empty ? [] : exampleTracks);
  const [time, setTime] = useState(props.startTime ?? 0.4);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [loopRange, setLoopRange] = useState({ start: 0.2, end: 1.8 });
  return (
    <Box maxH="sm" w={props.duration === undefined ? undefined : "2xl"}>
      <KeyframeTimeline
        label="Menu entrance"
        loopRange={loopRange}
        onLoopRangeChange={setLoopRange}
        loop={loop}
        onLoopChange={setLoop}
        playing={playing}
        onPlayingChange={setPlaying}
        duration={props.duration ?? 2}
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
  title: "Design system/Components/Media/Keyframe timeline",
  component: Example,
  description:
    "One compact transport toolbar with a visible repeat toggle. Pinch or Ctrl-scroll over the time ruler to zoom around the pointer; minimum zoom fits the tracks without horizontal overflow, and ordinary scrolling stays native. Right-click a track to add a keyframe at that position; its menu names the track and time. Right-click a keyframe to delete it. Shift+F10 opens the same menus from a focused track label or key. The active track is highlighted across its row. Groups use the app's rotating chevrons and shared reveal motion, including reduced motion; collapsed rows stay mounted and leave keyboard navigation. Drag the playhead along its full height or scrub empty track space. Selecting a key or marker aligns the playhead with its exact authored time. Tracks retain diamond keys, markers, frame snapping, loop handles and keyboard or pointer timing edits. Selection adds no detail row; values and interpolation belong to the caller. Omit onTracksChange for read-only tracks. Arrow keys move a focused key by one frame; Shift moves ten. Delete removes it.",
};
export default meta;
export const Animation: CanvasFrame = { id: "components-media-keyframe-timeline--animation" };
export const ReadOnly: CanvasFrame = { id: "components-media-keyframe-timeline--read-only", args: { readOnly: true } };
export const Empty: CanvasFrame = { id: "components-media-keyframe-timeline--empty", args: { empty: true } };
export const Long: CanvasFrame = { id: "components-media-keyframe-timeline--long", args: { duration: 20 } };

export const Overrun: CanvasFrame = { id: "components-media-keyframe-timeline--overrun", args: { startTime: 2.5 } };

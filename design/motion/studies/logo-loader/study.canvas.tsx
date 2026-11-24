import type { CanvasFrame } from "@pstdio/canvas";
import { motionCanvas } from "../../canvas-study";
import { LoaderPlayground, type PlaygroundArgs } from "./playground";
import Scene from "./scene";
import study from "./study.json";

export default { title: "Design system/Patterns/Motion/Brand/Logo loader", description: study.description };

// Scrubbable timeline: loop, success and failure side by side, with the result at 7 s.
export const Loader = { ...motionCanvas(study, Scene) };

export const Playground = {
  description:
    "Real-time run with your own loading duration and outcome. The loader plays for the loading duration, the outcome plays, the final pose holds, then it replays. Changing a setting or pressing Replay starts a fresh run.",
  args: {
    loading: 4,
    outcome: "success",
    hold: 2.5,
    replay: true,
    drum: "alternate",
    bounce: "lively",
    size: 160,
    reducedMotion: false,
  },
  controls: {
    loading: { label: "Loading duration (s)", type: "number", min: 0.2, max: 20, step: 0.1 },
    outcome: {
      label: "Outcome",
      type: "select",
      options: [
        { value: "success", label: "Success" },
        { value: "failure", label: "Failure" },
        { value: "loop", label: "Never resolves" },
      ],
    },
    hold: { label: "Hold after outcome (s)", type: "number", min: 0.5, max: 6, step: 0.1 },
    replay: { label: "Replay automatically", type: "boolean" },
    drum: {
      label: "Drum motion",
      type: "select",
      options: [
        { value: "alternate", label: "Turn and return" },
        { value: "oneway", label: "One direction" },
      ],
    },
    bounce: {
      label: "Bounce",
      type: "select",
      options: [
        { value: "lively", label: "Lively (restitution 0.6)" },
        { value: "soft", label: "Soft (restitution 0.35)" },
      ],
    },
    size: { label: "Preview size (px)", type: "number", min: 16, max: 256, step: 8 },
    reducedMotion: { label: "Reduced motion", type: "boolean" },
  },
  render: (args) => <LoaderPlayground {...args} />,
} satisfies CanvasFrame<PlaygroundArgs>;

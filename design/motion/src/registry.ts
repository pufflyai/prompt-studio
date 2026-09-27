import { MotionStudy } from "./composition";
import { defaultProps, FPS, studies } from "./model";

export const compositions = studies.flatMap((study) =>
  [false, true].map((comparison) => ({
    id: `${study.id}-${comparison ? "compare" : "single"}`,
    title: study.title,
    width: comparison ? 1920 : 1440,
    height: comparison ? 1080 : 900,
    fps: FPS,
    durationInFrames: study.duration * FPS,
    component: MotionStudy,
    defaultProps: { ...defaultProps, study: study.id, comparison },
  })),
);

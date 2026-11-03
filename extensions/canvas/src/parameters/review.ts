import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { useEffect, useRef, useState } from "react";
import type { CanvasItem } from "../canvas-model";
import type { commands } from "../commands";
import { type FrameParameters, playbackRange, type Values } from "./model";

export interface PlaybackSettings {
  time: number;
  rate: number;
  loop: boolean;
  start: number;
  end: number;
}
export const editableValues = (parameters: FrameParameters, values: Values) =>
  Object.fromEntries(Object.entries(values).filter(([key]) => Object.hasOwn(parameters.controls, key)));

// Hydration must not replace an edit made while that asynchronous read was pending.
export const useMotionReview = (props: {
  host?: GuestHost;
  item: CanvasItem;
  parameters: FrameParameters;
  untouched: () => boolean;
  apply: (values: Values) => void;
}) => {
  const { host, item, parameters } = props;
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  }, [props]);
  const [playback, setPlayback] = useState<PlaybackSettings>();
  useEffect(() => {
    const study = /^design\/motion\/studies\/([^/]+)\/study\.canvas\.tsx$/.exec(item.preview.source)?.[1];
    if (!host || !study || !parameters.motion) return;
    let active = true;
    void createWebviewClient<typeof commands>(host)
      .commands["review.read"]({ study })
      .then(
        (review) => {
          if (!active || !review.restored || !callbacks.current.untouched()) return;
          const side = item.preview.exportName === "Instant" ? review.settings.left : review.settings.right;
          callbacks.current.apply(
            editableValues(parameters, {
              ...side.values,
              preset: side.preset,
              reducedMotion: review.settings.reducedMotion,
            }),
          );
          setPlayback({
            time: review.frame / 60,
            rate: review.rate,
            loop: review.loop,
            ...playbackRange(
              parameters.motion!.duration,
              parameters.motion!.fps,
              review.loopRange ? [review.loopRange[0] / 60, review.loopRange[1] / 60] : undefined,
            ),
          });
        },
        () => {}, // Frames use source defaults when no saved review is available.
      );
    return () => {
      active = false;
    };
  }, [host, item.preview.source, item.preview.exportName, parameters]);
  return playback;
};

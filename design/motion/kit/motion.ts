import type { SceneProps } from "./model";
import { motionPresets } from "./presets";

export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const duration = (props: SceneProps, ms: number, spatial = false) => {
  if (props.variant.preset === "instant" || (spatial && props.reducedMotion)) return 0;
  return (ms / 1000) * motionPresets[props.variant.preset];
};
export const progress = (time: number, start: number, seconds: number, exit = false) => {
  if (time < start) return 0;
  if (seconds === 0) return 1;
  const p = clamp((time - start) / seconds);
  return exit ? p * p * p : 1 - (1 - p) ** 3;
};
// Each event starts from the value reached by the preceding event, including reversals.
export const track = (time: number, events: { at: number; value: number; duration: number }[], initial = 0) => {
  let from = initial;
  let target = initial;
  let start = 0;
  let seconds = 0;
  for (const event of events) {
    if (event.at > time) break;
    from = from + (target - from) * progress(event.at, start, seconds, target < from);
    target = event.value;
    start = event.at;
    seconds = event.duration;
  }
  return from + (target - from) * progress(time, start, seconds, target < from);
};
export const reveal = (props: SceneProps, start: number, ms: number, distance = 0) => {
  const opacity = progress(props.time, start, duration(props, ms));
  const movement = props.reducedMotion ? 1 : opacity;
  return { opacity, transform: `translateY(${distance * (1 - movement)}px)` };
};

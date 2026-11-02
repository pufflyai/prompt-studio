import type { AnimationKeyframe, KeyframeEasing, KeyframeSelection, KeyframeTrack } from "./keyframe-timeline.types";

export const snapTime = (time: number, duration: number, fps: number) =>
  Math.max(0, Math.min(duration, Math.round(time * fps) / fps));

export const editKeyframe = (
  track: KeyframeTrack,
  id: string,
  change: Partial<Omit<AnimationKeyframe, "id">>,
  duration: number,
  fps: number,
) => {
  const current = track.keyframes.find((key) => key.id === id);
  if (!current) return track;
  const next = {
    ...current,
    ...change,
    time: change.time === undefined ? current.time : snapTime(change.time, duration, fps),
  };
  if (
    change.time !== undefined &&
    track.keyframes.some((key) => key.id !== id && Math.round(key.time * fps) === Math.round(next.time * fps))
  )
    return track;
  return {
    ...track,
    keyframes: track.keyframes.map((key) => (key.id === id ? next : key)).sort((a, b) => a.time - b.time),
  };
};
const eased = (fraction: number, easing: KeyframeEasing = "linear") => {
  if (easing === "hold") return 0;
  if (easing === "ease-in") return fraction * fraction;
  if (easing === "ease-out") return 1 - (1 - fraction) ** 2;
  if (easing === "ease-in-out") return fraction * fraction * (3 - 2 * fraction);
  return fraction;
};
export const sampleTrack = (track: KeyframeTrack, time: number) => {
  const keys = [...track.keyframes].sort((a, b) => a.time - b.time);
  if (!keys.length) return 0;
  const right = keys.findIndex((key) => key.time > time);
  if (right < 0) return keys.at(-1)!.value;
  if (right === 0) return keys[0].value;
  const a = keys[right - 1];
  const b = keys[right];
  return a.value + (b.value - a.value) * eased((time - a.time) / (b.time - a.time), a.easing);
};
export const timeLabel = (time: number, fps: number) => {
  const frame = Math.round(time * fps);
  const nominalFps = Math.round(fps);
  const seconds = Math.floor(frame / nominalFps);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}:${String(frame % nominalFps).padStart(2, "0")}`;
};

export const selectedKeyframe = (tracks: KeyframeTrack[], selection: KeyframeSelection | null | undefined) => {
  const track = tracks.find((entry) => entry.id === selection?.trackId);
  const keyframe = track?.keyframes.find((key) => key.id === selection?.keyframeId);
  return track && keyframe ? { track, keyframe } : undefined;
};

import { defaultProps, FPS, type StudyProps, type Variant } from "./kit/model";
import type { StudyMetadata } from "./study-schema";

export interface ReviewState {
  settings: StudyProps;
  rate: number;
  loop: boolean;
  loopRange?: [number, number];
  frame: number;
  playing: boolean;
  startedAt: number;
}
export interface ReviewChange {
  settings?: Partial<Omit<StudyProps, "left" | "right">> & { left?: Partial<Variant>; right?: Partial<Variant> };
  rate?: number;
  loop?: boolean;
  loopRange?: [number, number];
  frame?: number;
  playing?: boolean;
}
export const initialState = (study: Pick<StudyMetadata, "id" | "params">) =>
  ({
    settings: {
      ...defaultProps,
      study: study.id,
      left: { preset: "instant", values: Object.fromEntries(study.params.map((p) => [p.id, p.default.left])) },
      right: { preset: "subtle", values: Object.fromEntries(study.params.map((p) => [p.id, p.default.right])) },
    },
    rate: 1,
    loop: false,
    frame: 0,
    playing: false,
    startedAt: 0,
  }) satisfies ReviewState;
export const loopBounds = (state: ReviewState, duration: number) => {
  const max = Math.max(2, Math.round(duration * FPS)) - 1;
  const start = Math.max(0, Math.min(max - 1, Math.round(state.loopRange?.[0] ?? 0)));
  const end = Math.max(start + 1, Math.min(max, Math.round(state.loopRange?.[1] ?? max)));
  return { start, end, max };
};
export const playbackPosition = (state: ReviewState, now: number, duration: number) => {
  const { start, end, max } = loopBounds(state, duration);
  const elapsed = state.playing ? (Math.max(0, now - state.startedAt) * FPS * state.rate) / 1000 : 0;
  const origin = state.loop && state.playing && (state.frame < start || state.frame > end) ? start : state.frame;
  const frame = Math.floor(origin + elapsed);
  return {
    frame: state.loop && state.playing ? start + ((frame - start) % (end - start + 1)) : Math.min(max, frame),
    playing: state.playing && (state.loop || frame < max),
  };
};
export const applyReviewChange = (current: ReviewState, change: ReviewChange, now: number, duration: number) => {
  const position = playbackPosition(current, now, duration);
  const study = current.settings.study;
  return {
    ...current,
    ...position,
    ...change,
    frame: Math.max(0, Math.min(Math.max(2, Math.round(duration * FPS)) - 1, change.frame ?? position.frame)),
    settings: {
      ...current.settings,
      ...change.settings,
      left: {
        ...current.settings.left,
        ...change.settings?.left,
        values: { ...current.settings.left.values, ...change.settings?.left?.values },
      },
      right: {
        ...current.settings.right,
        ...change.settings?.right,
        values: { ...current.settings.right.values, ...change.settings?.right?.values },
      },
      study,
    },
    startedAt: now,
  };
};

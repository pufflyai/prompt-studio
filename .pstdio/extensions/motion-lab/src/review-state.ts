import { defaultProps, FPS, getStudy, type StudyId, type StudyProps } from "@pstdio/motion-studies";

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
  settings?: Partial<StudyProps>;
  rate?: number;
  loop?: boolean;
  loopRange?: [number, number];
  frame?: number;
  playing?: boolean;
}
export const initialState = (study: StudyId) =>
  ({
    settings: { ...defaultProps, study },
    rate: 1,
    loop: false,
    frame: 0,
    playing: false,
    startedAt: 0,
  }) satisfies ReviewState;
export const loopBounds = (state: ReviewState) => {
  const max = getStudy(state.settings.study).duration * FPS - 1;
  const start = Math.max(0, Math.min(max - 1, Math.round(state.loopRange?.[0] ?? 0)));
  const end = Math.max(start + 1, Math.min(max, Math.round(state.loopRange?.[1] ?? max)));
  return { start, end, max };
};
export const playbackPosition = (state: ReviewState, now: number) => {
  const { start, end, max } = loopBounds(state);
  const elapsed = state.playing ? (Math.max(0, now - state.startedAt) * FPS * state.rate) / 1000 : 0;
  const origin = state.loop && state.playing && (state.frame < start || state.frame > end) ? start : state.frame;
  const frame = Math.floor(origin + elapsed);
  return {
    frame: state.loop && state.playing ? start + ((frame - start) % (end - start + 1)) : Math.min(max, frame),
    playing: state.playing && (state.loop || frame < max),
  };
};
export const applyReviewChange = (current: ReviewState, change: ReviewChange, now: number) => {
  const position = playbackPosition(current, now);
  const study = current.settings.study;
  return {
    ...current,
    ...position,
    ...change,
    frame: Math.max(0, Math.min(getStudy(study).duration * FPS - 1, change.frame ?? position.frame)),
    settings: { ...current.settings, ...change.settings, study },
    startedAt: now,
  };
};

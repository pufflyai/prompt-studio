export type KeyframeEasing = "linear" | "hold" | "ease-in" | "ease-out" | "ease-in-out";
export interface AnimationKeyframe {
  id: string;
  /** Seconds on the shared timeline. */
  time: number;
  value: number;
  /** Interpolation from this key to the next one. */
  easing?: KeyframeEasing;
}
export interface KeyframeTrack {
  id: string;
  label: string;
  group?: string;
  keyframes: AnimationKeyframe[];
}
export interface KeyframeSelection {
  trackId: string;
  keyframeId: string;
}
export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
}
export interface KeyframeTimelineProps {
  tracks: KeyframeTrack[];
  /** Positive duration in seconds. */
  duration: number;
  currentTime: number;
  framesPerSecond?: number;
  onTimeChange: (time: number) => void;
  /** Omit to review tracks without editing authored data. */
  onTracksChange?: (tracks: KeyframeTrack[]) => void;
  selection?: KeyframeSelection | null;
  onSelectionChange?: (selection: KeyframeSelection | null) => void;
  markers?: TimelineMarker[];
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** Override the default seek to zero, for example to restart a loop range. */
  onRestart?: () => void;
  label?: string;
}

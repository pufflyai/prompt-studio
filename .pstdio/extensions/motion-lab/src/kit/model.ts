import type { Preset } from "./presets";

export type { Preset } from "./presets";
export const FPS = 60;
export interface Variant {
  preset: Preset;
  values: Record<string, string>;
}
export interface StudyProps extends Record<string, unknown> {
  study: string;
  comparison: boolean;
  theme: "dark" | "light";
  reducedMotion: boolean;
  left: Variant;
  right: Variant;
}
export const defaultProps: StudyProps = {
  study: "chat-turn",
  comparison: true,
  theme: "dark",
  reducedMotion: false,
  left: { preset: "instant", values: {} },
  right: { preset: "subtle", values: {} },
};
export interface SceneProps {
  time: number;
  variant: Variant;
  reducedMotion: boolean;
}

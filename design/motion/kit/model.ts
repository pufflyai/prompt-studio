import type { Preset } from "./presets";

export type { Preset } from "./presets";
export interface Variant {
  preset: Preset;
  values: Record<string, string>;
}
export interface SceneProps {
  time: number;
  variant: Variant;
  reducedMotion: boolean;
}

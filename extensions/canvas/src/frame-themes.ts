import { defaultThemePreferences, type ThemePreferenceOption } from "@pstdio/ui";
import type { FrameTheme } from "./layout";

export const frameThemePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences;

export const frameThemes = (authored?: string) => [
  { id: "app", title: "Follow app" },
  ...frameThemePreferences.map(({ id, title }) => ({ id, title: title ?? id })),
  // A theme the project defines itself, such as an imported editor palette.
  ...(authored && !frameThemePreferences.some((theme) => theme.id === authored)
    ? [{ id: authored, title: authored }]
    : []),
];

export const resolveFrameTheme = (saved: FrameTheme | undefined, authored: string | undefined) =>
  saved ?? authored ?? "app";

// The frame receives the whole theme. For a theme only the project knows, it gets the id and the
// app's mode, and the project's decorator supplies the colors.
export const frameThemeOption = (id: FrameTheme, app: ThemePreferenceOption | undefined): ThemePreferenceOption => {
  const fallback = app ?? { id: "pstdio-light", mode: "light" };
  if (id === "app") return fallback;
  return frameThemePreferences.find((theme) => theme.id === id) ?? { id, mode: fallback.mode };
};

import themes from "./catalog/generated/frame-themes.json";

export const frameThemePreferences = [
  { id: "pstdio-light", title: "Light", mode: "light" },
  { id: "pstdio-dark", title: "Dark", mode: "dark" },
  ...themes,
] as const;
export const frameThemes = [
  { id: "app", title: "Follow app" },
  ...frameThemePreferences.map(({ id, title }) => ({ id, title })),
];
export type FrameTheme = (typeof frameThemes)[number]["id"];
export const isFrameTheme = (value: unknown): value is FrameTheme => frameThemes.some((theme) => theme.id === value);

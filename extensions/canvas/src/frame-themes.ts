import themes from "./catalog/generated/frame-themes.json";

export const frameThemePreferences = themes;
export const frameThemes = [
  { id: "app", title: "Follow app" },
  ...frameThemePreferences.map(({ id, title }) => ({ id, title })),
];
export type FrameTheme = (typeof frameThemes)[number]["id"];
export const isFrameTheme = (value: unknown): value is FrameTheme => frameThemes.some((theme) => theme.id === value);

export const resolveFrameTheme = (saved: FrameTheme | undefined, authored: string | undefined) =>
  saved ?? (isFrameTheme(authored) ? authored : "app");

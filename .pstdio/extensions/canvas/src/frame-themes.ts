export const frameThemes = [
  { id: "app", title: "Follow app" },
  { id: "pstdio-light", title: "Light" },
  { id: "pstdio-dark", title: "Dark" },
  { id: "solarized-light", title: "Solarized Light" },
  { id: "solarized-dark", title: "Solarized Dark" },
  { id: "dracula", title: "Dracula" },
  { id: "monokai", title: "Monokai" },
] as const;
export type FrameTheme = (typeof frameThemes)[number]["id"];
export const isFrameTheme = (value: unknown): value is FrameTheme => frameThemes.some((theme) => theme.id === value);

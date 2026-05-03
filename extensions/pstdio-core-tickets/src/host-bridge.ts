import type { ThemePreference } from "@pstdio/ui";

interface CommandPaletteShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

const isRecord = (value: unknown) => typeof value === "object" && value !== null;

export const getThemePreferenceFromSearch = (search: string) =>
  new URLSearchParams(search).get("themePreference")?.trim() ?? "";

export const readHostThemeMessage = (value: unknown) => {
  if (
    !isRecord(value) ||
    !("type" in value) ||
    value.type !== "pstdio.host.themePreference" ||
    !("themePreference" in value) ||
    typeof value.themePreference !== "string"
  ) {
    return null;
  }

  return value.themePreference;
};

export const buildOpenCommandPaletteMessage = () => ({
  type: "pstdio.extension.openCommandPalette",
});

export const buildSetThemePreferenceMessage = (themePreference: ThemePreference) => ({
  type: "pstdio.extension.setThemePreference",
  themePreference,
});

export const shouldForwardCommandPaletteShortcut = (event: CommandPaletteShortcutInput) =>
  event.key.toLowerCase() === "p" && event.shiftKey === true && (event.ctrlKey === true || event.metaKey === true);

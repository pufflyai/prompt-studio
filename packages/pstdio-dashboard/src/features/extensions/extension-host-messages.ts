import type { ThemePreference } from "@pstdio/ui";

const isRecord = (value: unknown) => typeof value === "object" && value !== null;

export const readExtensionHostMessage = (value: unknown) => {
  if (!isRecord(value) || !("type" in value)) return null;

  if (value.type === "pstdio.extension.openCommandPalette") {
    return { type: "open-command-palette" as const };
  }

  if (
    value.type === "pstdio.extension.setThemePreference" &&
    "themePreference" in value &&
    typeof value.themePreference === "string"
  ) {
    return { type: "set-theme-preference" as const, themePreference: value.themePreference };
  }

  return null;
};

export const buildExtensionThemeMessage = (themePreference: ThemePreference) => ({
  type: "pstdio.host.themePreference",
  themePreference,
});

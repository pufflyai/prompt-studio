import type { ThemePreference } from "@pstdio/ui";

const toastTypes = ["info", "success", "warning", "error"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isToastType = (value: unknown): value is (typeof toastTypes)[number] =>
  typeof value === "string" && toastTypes.includes(value as (typeof toastTypes)[number]);

const readToast = (value: unknown) => {
  if (!isRecord(value) || !isToastType(value.type) || typeof value.description !== "string") return null;

  return {
    type: value.type,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    description: value.description,
  };
};

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

  if (value.type === "pstdio.extension.showToast") {
    const toast = readToast(value.toast);
    if (!toast) return null;

    return { type: "show-toast" as const, toast };
  }

  return null;
};

export const buildExtensionThemeMessage = (themePreference: ThemePreference) => ({
  type: "pstdio.host.themePreference",
  themePreference,
});

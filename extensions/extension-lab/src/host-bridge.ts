import type { ThemePreference } from "@pstdio/ui";

interface CommandPaletteShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

interface HostCommandOutcome {
  status: "success" | "rejected" | "error";
  reason?: string;
  notices?: { type: "info" | "success" | "warning" | "error"; title?: string; message: string }[];
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

const buildHostToastMessage = (toast: {
  type: "info" | "success" | "warning" | "error";
  title?: string;
  description: string;
}) => ({
  type: "pstdio.extension.showToast",
  toast,
});

export const buildHostCommandOutcomeToastMessages = (label: string, outcome: HostCommandOutcome) => {
  if (outcome.notices?.length) {
    return outcome.notices.map((notice) =>
      buildHostToastMessage({
        type: notice.type,
        title: notice.title ?? label,
        description: notice.message,
      }),
    );
  }

  if (outcome.status === "success") {
    return [buildHostToastMessage({ type: "success", title: label, description: "Extension command completed." })];
  }

  return [
    buildHostToastMessage({
      type: outcome.status === "rejected" ? "warning" : "error",
      title: label,
      description: outcome.reason ?? "Extension command failed.",
    }),
  ];
};

export const shouldForwardCommandPaletteShortcut = (event: CommandPaletteShortcutInput) =>
  event.key.toLowerCase() === "p" && event.shiftKey === true && (event.ctrlKey === true || event.metaKey === true);

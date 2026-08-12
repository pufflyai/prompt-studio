export type BrowserPreviewViewport =
  | { mode: "responsive" }
  | { mode: "desktop" }
  | { mode: "mobile" }
  | { mode: "custom"; width: number; height: number };

export const browserPreviewViewportPresets = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
  custom: {
    minWidth: 320,
    maxWidth: 1600,
    minHeight: 240,
    maxHeight: 1600,
  },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const clampInteger = (value: unknown, min: number, max: number) => {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, numeric));
};

export const normalizeBrowserPreviewViewport = (value: unknown): BrowserPreviewViewport => {
  if (!isRecord(value) || typeof value.mode !== "string") return { mode: "responsive" };
  if (value.mode === "responsive" || value.mode === "desktop" || value.mode === "mobile") return { mode: value.mode };
  if (value.mode !== "custom") return { mode: "responsive" };

  return {
    mode: "custom",
    width: clampInteger(
      value.width,
      browserPreviewViewportPresets.custom.minWidth,
      browserPreviewViewportPresets.custom.maxWidth,
    ),
    height: clampInteger(
      value.height,
      browserPreviewViewportPresets.custom.minHeight,
      browserPreviewViewportPresets.custom.maxHeight,
    ),
  };
};

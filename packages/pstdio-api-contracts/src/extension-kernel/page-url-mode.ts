import type { ModeRef } from "./types/contribution-identity";
export const pageModeQueryValue = (mode: ModeRef) =>
  mode.extensionId && mode.extensionId !== "pstdio" ? `${mode.extensionId}.mode.${mode.id}` : mode.id;
export const pageModeLocation = (query: URLSearchParams) =>
  query.has("_mode") ? { mode: { kind: "mode" as const, extensionId: "pstdio", id: query.get("_mode")! } } : {};

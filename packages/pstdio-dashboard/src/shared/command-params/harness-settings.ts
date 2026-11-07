import type { HarnessParamValues } from "@pstdio/ui/param-editor";

/** Sessions merge persisted settings; command forms store only explicit overrides. */
export const changedHarnessParams = (
  overrides: HarnessParamValues,
  defaults: HarnessParamValues,
  settingsMode?: "overrides" | "resolved",
) => (settingsMode === "resolved" ? { ...defaults, ...overrides } : overrides);

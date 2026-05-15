import type { ShellModeContribution } from "pstdio-shell/core";
import { ZEN_MODE_ID, zenMode } from "./constants";

export const createZenMode = (): ShellModeContribution => ({
  id: ZEN_MODE_ID,
  label: zenMode.label,
  activate: () => undefined,
});

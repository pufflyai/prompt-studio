import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { ExtensionRuntime } from "pstdio-extensions";
import { addDiagnostic } from "./extension-diagnostics";
import { reservedDashboardModeIds, resolveModeId } from "./extension-mode-identity";

// Mode duplication checks live with the check adapter: normalize emits the raw
// `RuntimeModeRecord` and validates composition recipes, and the adapter resolves
// the mode id and flags duplicates within the single source being checked.
export const collectCheckModes = (check: ExtensionsCheckResponse, runtime: ExtensionRuntime) => {
  const seenModeIds = new Set<string>();
  for (const mode of runtime.modes) {
    const modeId = resolveModeId({
      extensionName: mode.name,
      localId: mode.localId,
      id: mode.contribution.id,
    });
    if (reservedDashboardModeIds.has(modeId) || seenModeIds.has(modeId)) {
      addDiagnostic(check, {
        code: "extension_mode_duplicate",
        extensionId: mode.extensionId,
        message: `Extension "${mode.extensionId}" declares duplicate workbench mode "${modeId}"`,
        metadata: { modeId },
        severity: "error",
        sourcePath: mode.sourcePath,
      });
      continue;
    }
    seenModeIds.add(modeId);
    check.modes.push({
      id: mode.id,
      extensionId: mode.extensionId,
      modeId,
      label: mode.contribution.label,
      icon: typeof mode.contribution.icon === "string" ? mode.contribution.icon : undefined,
      panelRegions: mode.contribution.panelRegions ? [...mode.contribution.panelRegions] : undefined,
      resources: mode.contribution.resources as (typeof check.modes)[number]["resources"],
      modePanels: mode.contribution.modePanels as (typeof check.modes)[number]["modePanels"],
    });
  }
};

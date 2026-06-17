import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { ExtensionRuntime } from "pstdio-extensions";
import { addDiagnostic } from "./extension-diagnostics";
import { normalizeModeLayout, reservedDashboardModeIds, resolveModeId } from "./extension-mode-layout";

// Mode layout/duplication checks live with the check adapter (mirroring what
// `buildWorkbenchExtensionMetadata` does for the workbench surface): normalize
// emits the raw `RuntimeModeRecord`, the adapter resolves the legacy modeId,
// validates layout via the host's `extension-mode-layout`, and flags
// duplicates within the single source being checked.
export const collectCheckModes = (check: ExtensionsCheckResponse, runtime: ExtensionRuntime) => {
  const viewIdsByName = new Map<string, Map<string, string>>();
  for (const view of runtime.views) {
    const entry = viewIdsByName.get(view.name) ?? new Map<string, string>();
    entry.set(view.localId, view.id);
    viewIdsByName.set(view.name, entry);
  }
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
    const normalized = normalizeModeLayout({
      extensionId: mode.extensionId,
      extensionName: mode.name,
      layout: mode.contribution.layout,
      modeId,
      sourcePath: mode.sourcePath,
      viewIdsByLocalId: viewIdsByName.get(mode.name) ?? new Map<string, string>(),
    });
    if (normalized.diagnostic) {
      addDiagnostic(check, normalized.diagnostic);
      continue;
    }
    seenModeIds.add(modeId);
    const resourceKind =
      typeof mode.contribution.resourceKind === "string" ? mode.contribution.resourceKind : undefined;
    check.modes.push({
      id: mode.id,
      extensionId: mode.extensionId,
      modeId,
      label: mode.contribution.label,
      icon: typeof mode.contribution.icon === "string" ? mode.contribution.icon : undefined,
      ...(resourceKind !== undefined ? { resourceKind } : {}),
      layout: normalized.layout,
    });
  }
};

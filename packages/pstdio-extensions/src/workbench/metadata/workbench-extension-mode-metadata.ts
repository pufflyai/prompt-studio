import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { normalizeWorkbenchModePanels, workbenchRegions } from "pstdio-api-contracts/extension-kernel";
import type { ExtensionRuntime } from "../../types/runtime";

type ExtensionDiagnostic = WorkbenchExtensionMetadata["diagnostics"][number];
type ExtensionModeRecord = WorkbenchExtensionMetadata["modes"][number];
type ModeLayoutContributionRecord = NonNullable<ExtensionModeRecord["layout"]>;
type ModeLayoutOpenEntry = NonNullable<ModeLayoutContributionRecord["open"]>[number];
interface ModeOpenEntriesValidation {
  invalidOpenEntry: boolean;
  missingViews: string[];
  open: ModeLayoutOpenEntry[];
  unavailableOpenRegions: string[];
  unsafeOpenTargets: string[];
}

const reservedModeIds = new Set(["project-selection", "project", "workspace", "settings"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const viewIdsByExtensionId = (panels: ExtensionRuntime["panels"]) => {
  const byExtension = new Map<string, Map<string, string>>();
  for (const panel of panels) {
    const extensionViews = byExtension.get(panel.extensionId) ?? new Map<string, string>();
    extensionViews.set(panel.localId, panel.id);
    byExtension.set(panel.extensionId, extensionViews);
  }
  return byExtension;
};

const resolveModeId = (mode: ExtensionRuntime["modes"][number]) =>
  typeof mode.contribution.id === "string" && mode.contribution.id.length > 0
    ? mode.contribution.id
    : `${mode.name}.${mode.localId}`;

const modeResourceKind = (mode: ExtensionRuntime["modes"][number]) =>
  typeof mode.contribution.resourceKind === "string" ? mode.contribution.resourceKind : undefined;

const createLayoutDiagnostic = (
  mode: ExtensionRuntime["modes"][number],
  modeId: string,
  metadata: Record<string, unknown>,
): ExtensionDiagnostic => ({
  code: "extension_mode_layout_invalid",
  extensionId: mode.extensionId,
  message: `Extension "${mode.extensionId}" mode "${modeId}" declares an invalid layout`,
  metadata: { modeId, ...metadata },
  severity: "error",
  sourcePath: mode.sourcePath,
});

const resolveModeViewId = (
  panel: string,
  mode: ExtensionRuntime["modes"][number],
  viewIdsByLocalId: Map<string, string>,
) => viewIdsByLocalId.get(panel) ?? (panel.startsWith(`${mode.name}.`) ? panel : undefined);

const modePanelForRegion = (region: ModeLayoutOpenEntry["region"]) => {
  if (region === "main" || region === "main-header") return "main";
  if (region === "secondary" || region === "secondary-header") return "secondary";
  if (region === "side" || region === "side-header") return "side";
  return undefined;
};

const normalizeModeOpenEntry = (
  rawEntry: unknown,
  mode: ExtensionRuntime["modes"][number],
  viewIdsByLocalId: Map<string, string>,
  panels: NonNullable<ModeLayoutContributionRecord["panels"]>,
) => {
  if (!isRecord(rawEntry)) return { invalid: true };
  const entry: ModeLayoutOpenEntry = {};
  if (typeof rawEntry.title === "string") entry.title = rawEntry.title;
  if (typeof rawEntry.pinned === "boolean") entry.pinned = rawEntry.pinned;
  if (typeof rawEntry.resource === "string") entry.resource = rawEntry.resource;
  if (rawEntry.region !== undefined) {
    if (!(workbenchRegions as readonly unknown[]).includes(rawEntry.region))
      return { unsafeTarget: String(rawEntry.region) };
    entry.region = rawEntry.region as ModeLayoutOpenEntry["region"];
    const modePanel = modePanelForRegion(entry.region);
    if (modePanel && !panels.includes(modePanel)) return { unavailableRegion: entry.region };
  }
  if (typeof rawEntry.panel === "string") {
    const viewId = resolveModeViewId(rawEntry.panel, mode, viewIdsByLocalId);
    if (!viewId) return { missingView: rawEntry.panel };
    entry.panel = viewId;
  }
  if (!entry.panel && !entry.resource) return { invalid: true };
  return { entry };
};

const normalizeOpenEntries = (
  rawOpen: unknown,
  mode: ExtensionRuntime["modes"][number],
  viewIdsByLocalId: Map<string, string>,
  panels: NonNullable<ModeLayoutContributionRecord["panels"]>,
) => {
  const validation: ModeOpenEntriesValidation = {
    invalidOpenEntry: rawOpen !== undefined && !Array.isArray(rawOpen),
    missingViews: [],
    open: [],
    unavailableOpenRegions: [],
    unsafeOpenTargets: [],
  };

  if (!Array.isArray(rawOpen)) return validation;
  for (const rawEntry of rawOpen) {
    const result = normalizeModeOpenEntry(rawEntry, mode, viewIdsByLocalId, panels);
    if (result.entry) validation.open.push(result.entry);
    if (result.unsafeTarget) validation.unsafeOpenTargets.push(result.unsafeTarget);
    if (result.unavailableRegion) validation.unavailableOpenRegions.push(result.unavailableRegion);
    if (result.missingView) validation.missingViews.push(result.missingView);
    if (result.invalid) validation.invalidOpenEntry = true;
  }
  return validation;
};

const createModeLayoutDiagnostic = (
  mode: ExtensionRuntime["modes"][number],
  modeId: string,
  validation: ModeOpenEntriesValidation,
) => {
  const metadata: Record<string, unknown> = {};
  if (validation.unsafeOpenTargets.length) metadata.unsafeOpenTargets = validation.unsafeOpenTargets;
  if (validation.unavailableOpenRegions.length) {
    metadata.unavailableOpenRegions = validation.unavailableOpenRegions;
  }
  if (validation.missingViews[0]) {
    metadata.missingView = validation.missingViews[0];
    metadata.missingViews = validation.missingViews;
  }
  if (validation.invalidOpenEntry) metadata.invalidOpenEntry = true;

  if (Object.keys(metadata).length === 0) return undefined;
  return createLayoutDiagnostic(mode, modeId, metadata);
};

const buildModeLayout = (
  layout: Record<string, unknown>,
  panels: NonNullable<ModeLayoutContributionRecord["panels"]>,
  open: ModeLayoutOpenEntry[],
) => ({
  panels,
  ...(layout.open !== undefined ? { open } : {}),
});

const normalizeModeLayout = (
  mode: ExtensionRuntime["modes"][number],
  modeId: string,
  viewIdsByLocalId: Map<string, string>,
) => {
  const layout = mode.contribution.layout;
  if (layout === undefined) return { layout: undefined };
  if (!isRecord(layout)) return { diagnostic: createLayoutDiagnostic(mode, modeId, { invalidLayout: true }) };

  const { panels, invalid: invalidPanels } = normalizeWorkbenchModePanels(layout.panels);
  if (invalidPanels) return { diagnostic: createLayoutDiagnostic(mode, modeId, { invalidPanels: true }) };

  const validation = normalizeOpenEntries(layout.open, mode, viewIdsByLocalId, panels);
  const diagnostic = createModeLayoutDiagnostic(mode, modeId, validation);
  if (diagnostic) return { diagnostic };

  return { layout: buildModeLayout(layout, panels, validation.open) };
};

export const toWorkbenchExtensionModeRecords = (runtime: ExtensionRuntime) => {
  const modes: ExtensionModeRecord[] = [];
  const diagnostics: WorkbenchExtensionMetadata["diagnostics"] = [...runtime.diagnostics];
  const modeIds = new Set(reservedModeIds);
  const viewIds = viewIdsByExtensionId(runtime.panels);

  for (const mode of runtime.modes) {
    const modeId = resolveModeId(mode);
    if (modeIds.has(modeId)) {
      diagnostics.push({
        code: "extension_mode_duplicate",
        extensionId: mode.extensionId,
        message: `Extension "${mode.extensionId}" declares duplicate workbench mode "${modeId}"`,
        metadata: { modeId },
        severity: "error",
        sourcePath: mode.sourcePath,
      });
      continue;
    }

    const normalized = normalizeModeLayout(mode, modeId, viewIds.get(mode.extensionId) ?? new Map());
    if (normalized.diagnostic) {
      diagnostics.push(normalized.diagnostic);
      continue;
    }

    modeIds.add(modeId);
    const resourceKind = modeResourceKind(mode);
    modes.push({
      id: mode.id,
      extensionId: mode.extensionId,
      modeId,
      label: mode.contribution.label,
      icon: mode.contribution.icon,
      ...(resourceKind !== undefined ? { resourceKind } : {}),
      layout: normalized.layout,
    });
  }

  return { diagnostics, modes };
};

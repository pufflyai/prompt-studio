import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import {
  getWorkbenchModeLayoutTargetPanel,
  normalizeWorkbenchModePanels,
  workbenchModeLayoutTargets,
  type workbenchModePanels,
} from "pstdio-api-contracts/extension-kernel";
import type { ExtensionRuntime } from "../../types/runtime";

type ExtensionDiagnostic = WorkbenchExtensionMetadata["diagnostics"][number];
type ExtensionModeRecord = WorkbenchExtensionMetadata["modes"][number];
type ModeLayoutContributionRecord = NonNullable<ExtensionModeRecord["layout"]>;
type ModeLayoutOpenEntry = NonNullable<ModeLayoutContributionRecord["open"]>[number];
type ModeLayoutTarget = ModeLayoutOpenEntry["target"];
interface ModeOpenEntriesValidation {
  invalidOpenEntry: boolean;
  missingViews: string[];
  open: ModeLayoutOpenEntry[];
  unavailableOpenTargets: string[];
  unsafeOpenTargets: string[];
}

const reservedModeIds = new Set(["project-selection", "project", "workspace", "settings"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const viewIdsByExtensionId = (views: ExtensionRuntime["views"]) => {
  const byExtension = new Map<string, Map<string, string>>();
  for (const view of views) {
    const extensionViews = byExtension.get(view.extensionId) ?? new Map<string, string>();
    extensionViews.set(view.localId, view.id);
    byExtension.set(view.extensionId, extensionViews);
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
  view: string,
  mode: ExtensionRuntime["modes"][number],
  viewIdsByLocalId: Map<string, string>,
) => viewIdsByLocalId.get(view) ?? (view.startsWith(`${mode.name}.`) ? view : undefined);

const normalizeModeOpenEntry = (
  rawEntry: unknown,
  mode: ExtensionRuntime["modes"][number],
  viewIdsByLocalId: Map<string, string>,
  panels: readonly (typeof workbenchModePanels)[number][],
) => {
  const target = isRecord(rawEntry) ? String(rawEntry.target) : String(rawEntry);
  if (!isRecord(rawEntry) || !(workbenchModeLayoutTargets as readonly string[]).includes(target)) {
    return { unsafeTarget: isRecord(rawEntry) ? String(rawEntry.target) : String(rawEntry) };
  }

  const modeTarget = rawEntry.target as ModeLayoutTarget;
  const targetPanel = getWorkbenchModeLayoutTargetPanel(modeTarget);
  if (targetPanel && !panels.includes(targetPanel)) return { unavailableTarget: modeTarget };

  const entry: ModeLayoutOpenEntry = { target: modeTarget };
  if (typeof rawEntry.title === "string") entry.title = rawEntry.title;
  if (typeof rawEntry.pinned === "boolean") entry.pinned = rawEntry.pinned;
  if (typeof rawEntry.widget === "string") entry.widget = rawEntry.widget;
  if (typeof rawEntry.resource === "string") entry.resource = rawEntry.resource;
  if (typeof rawEntry.view === "string") {
    const viewId = resolveModeViewId(rawEntry.view, mode, viewIdsByLocalId);
    if (!viewId) return { missingView: rawEntry.view };
    entry.view = viewId;
  }
  if (!entry.view && !entry.resource) return { invalid: true };
  return { entry };
};

const normalizeOpenEntries = (
  rawOpen: unknown,
  mode: ExtensionRuntime["modes"][number],
  viewIdsByLocalId: Map<string, string>,
  panels: readonly (typeof workbenchModePanels)[number][],
) => {
  const validation: ModeOpenEntriesValidation = {
    invalidOpenEntry: rawOpen !== undefined && !Array.isArray(rawOpen),
    missingViews: [],
    open: [],
    unavailableOpenTargets: [],
    unsafeOpenTargets: [],
  };

  if (!Array.isArray(rawOpen)) return validation;
  for (const rawEntry of rawOpen) {
    const result = normalizeModeOpenEntry(rawEntry, mode, viewIdsByLocalId, panels);
    if (result.entry) validation.open.push(result.entry);
    if (result.unsafeTarget) validation.unsafeOpenTargets.push(result.unsafeTarget);
    if (result.unavailableTarget) validation.unavailableOpenTargets.push(result.unavailableTarget);
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
  if (validation.unavailableOpenTargets.length) {
    metadata.unavailableOpenTargets = validation.unavailableOpenTargets;
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
  const viewIds = viewIdsByExtensionId(runtime.views);

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

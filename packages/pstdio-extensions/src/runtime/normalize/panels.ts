import type {
  NormalizedExtension,
  RuntimeActivityItemRecord,
  RuntimePanelRecord,
  RuntimeRouteRecord,
  RuntimeSettingsPanelRecord,
  RuntimeSettingsSectionRecord,
  RuntimeTreeItemRecord,
} from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { isLocalizableString } from "./localizable";
import { hasCompatibleSlotKind } from "./slot-kind";
import { hasCompatibleWorkbenchTarget, hasRequiredWorkbenchTarget } from "./workbench-targets";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

const sourceRef = (ext: NormalizedExtension, source: LoadedExtensionSource) => ({
  extensionId: ext.id,
  sourcePath: source.sourcePath,
});

const hasEmptyEligibleLocations = (panel: Record<string, unknown>) => {
  const eligibleLocations = panel.eligibleLocations;
  return isRecord(eligibleLocations) && Object.keys(eligibleLocations).length === 0;
};

const resolveRendererId = (ext: NormalizedExtension, localOrFullId: string) => {
  const id = localOrFullId.startsWith(`${ext.name}.`) ? localOrFullId : `${ext.name}.${localOrFullId}`;
  return id;
};

const rendererRecords = (runtime: Accumulator, kind: string) => {
  if (kind === "tree") return runtime.treeRenderers;
  if (kind === "file") return runtime.fileRenderers;
  if (kind === "controls") return runtime.controlsRenderers;
  if (kind === "dataTable") return runtime.dataTableRenderers;
  if (kind === "kanban") return runtime.kanbanRenderers;
  return [];
};

// Each renderer-backed panel references a renderer by local/full id; fail loudly when it
// points at one that was not registered (mirrors the tree/file/controls renderer passes).
const rendererBodyResolves = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  panel: Record<string, unknown>,
  id: string,
) => {
  if (!isRecord(panel.renderer)) return true;
  const kind = panel.renderer.kind;
  const localId = panel.renderer.id;
  if (typeof kind !== "string" || typeof localId !== "string") return false;
  const rendererId = resolveRendererId(ext, localId);
  if (rendererRecords(runtime, kind).some((renderer) => renderer.id === rendererId)) return true;
  runtime.diagnostics.push(
    createDiagnostic({
      code: "extension_panel_renderer_missing",
      message: `Panel "${id}" references unknown ${kind} renderer "${localId}"`,
      extensionId: ext.id,
      sourcePath: source.sourcePath,
      metadata: { contributionId: id, renderer: { kind, id: localId } },
    }),
  );
  return false;
};

const registerPanels = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, panel] of Object.entries(source.definition.panels ?? {})) {
    if (!isRecord(panel) || !isLocalizableString(panel.title)) continue;
    const id = contributionId(ext, localId);
    const hasWebview = isRecord(panel.webview);
    const hasRenderer = isRecord(panel.renderer);

    if ([hasWebview, hasRenderer].filter(Boolean).length !== 1) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_view_body_invalid",
          message: `Panel "${id}" must declare exactly one of webview or renderer`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    if (!rendererBodyResolves(ext, source, runtime, panel, id)) continue;

    if (typeof panel.region !== "string" || typeof panel.closable !== "boolean") {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_panel_contract_invalid",
          message: `Panel "${id}" must declare region and closable`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    if (hasEmptyEligibleLocations(panel)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_panel_empty_eligible_locations",
          severity: "warning",
          message: `Panel "${id}" declares eligibleLocations with no constraints, so it becomes a sub-panel/tab that is eligible in every matching location`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
    }

    runtime.panels.push({
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: panel as RuntimePanelRecord["contribution"],
    });
  }
};

const registerTreeItems = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, item] of Object.entries(source.definition.treeItems ?? {})) {
    if (!isRecord(item) || !isLocalizableString(item.label) || !isRecord(item.action)) continue;
    const id = contributionId(ext, localId);
    if (
      !hasRequiredWorkbenchTarget({
        runtime,
        source: sourceRef(ext, source),
        expected: "treeItem",
        target: item.target,
        contributionId: id,
      })
    ) {
      continue;
    }
    runtime.treeItems.push({
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: item as RuntimeTreeItemRecord["contribution"],
    });
  }
};

const registerActivityItems = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, item] of Object.entries(source.definition.activityItems ?? {})) {
    if (!isRecord(item) || !isLocalizableString(item.title) || typeof item.icon !== "string") continue;
    if (!Array.isArray(item.modes) || item.modes.length === 0) continue;
    runtime.activityItems.push({
      id: contributionId(ext, localId),
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: item as RuntimeActivityItemRecord["contribution"],
    });
  }
};

const registerRoutes = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, route] of Object.entries(source.definition.routes ?? {})) {
    if (!isRecord(route) || typeof route.path !== "string" || !isLocalizableString(route.label)) continue;
    runtime.routes.push({
      id: contributionId(ext, localId),
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: route as RuntimeRouteRecord["contribution"],
    });
  }
};

const registerSettingsSections = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, section] of Object.entries(source.definition.settingsSections ?? {})) {
    if (!isRecord(section) || !isLocalizableString(section.title)) continue;
    runtime.settingsSections.push({
      id: contributionId(ext, localId),
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: section as RuntimeSettingsSectionRecord["contribution"],
    });
  }
};

const registerSettingsPanels = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, panel] of Object.entries(source.definition.settingsPanels ?? {})) {
    if (!isRecord(panel) || !isLocalizableString(panel.title)) continue;
    const id = contributionId(ext, localId);
    const validTarget =
      typeof panel.target === "string"
        ? hasCompatibleWorkbenchTarget({
            runtime,
            source: sourceRef(ext, source),
            expected: "settings",
            target: panel.target,
            contributionId: id,
          })
        : hasCompatibleSlotKind({
            runtime,
            source: sourceRef(ext, source),
            expected: "settings",
            slot: panel.slot,
            contributionId: id,
          });
    if (!validTarget) {
      continue;
    }
    if (typeof panel.target === "string" && panel.scope !== "project" && panel.scope !== "global") {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_settings_scope_invalid",
          message: `Settings panel "${id}" must declare scope "project" or "global"`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id, target: panel.target },
        }),
      );
      continue;
    }
    runtime.settingsPanels.push({
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: panel as RuntimeSettingsPanelRecord["contribution"],
    });
  }
};

export const registerPanelContributions = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  registerPanels(ext, source, runtime);
  registerRoutes(ext, source, runtime);
  registerTreeItems(ext, source, runtime);
  registerActivityItems(ext, source, runtime);
  registerSettingsSections(ext, source, runtime);
  registerSettingsPanels(ext, source, runtime);
};

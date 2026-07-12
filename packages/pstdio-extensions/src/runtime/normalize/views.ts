import type {
  NormalizedExtension,
  RuntimeRouteRecord,
  RuntimeSettingsPanelRecord,
  RuntimeTreeItemRecord,
  RuntimeViewRecord,
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

const modeLayoutViewKeys = (source: LoadedExtensionSource) => {
  const keys = new Set<string>();

  for (const mode of Object.values(source.definition.modes ?? {})) {
    if (!isRecord(mode) || !isRecord(mode.layout) || !Array.isArray(mode.layout.open)) continue;
    for (const entry of mode.layout.open) {
      if (isRecord(entry) && typeof entry.view === "string") keys.add(entry.view);
    }
  }

  return keys;
};

const resolveTreeRendererId = (ext: NormalizedExtension, localOrFullId: string, runtime: Accumulator) => {
  const id = localOrFullId.startsWith(`${ext.name}.`) ? localOrFullId : `${ext.name}.${localOrFullId}`;
  return runtime.treeRenderers.some((renderer) => renderer.id === id) ? id : undefined;
};

const resolveFileRendererId = (ext: NormalizedExtension, localOrFullId: string, runtime: Accumulator) => {
  const id = localOrFullId.startsWith(`${ext.name}.`) ? localOrFullId : `${ext.name}.${localOrFullId}`;
  return runtime.fileRenderers.some((renderer) => renderer.id === id) ? id : undefined;
};

const resolveControlsRendererId = (ext: NormalizedExtension, localOrFullId: string, runtime: Accumulator) => {
  const id = localOrFullId.startsWith(`${ext.name}.`) ? localOrFullId : `${ext.name}.${localOrFullId}`;
  return runtime.controlsRenderers.some((renderer) => renderer.id === id) ? id : undefined;
};

const resolveDataTableRendererId = (ext: NormalizedExtension, localOrFullId: string, runtime: Accumulator) => {
  const id = localOrFullId.startsWith(`${ext.name}.`) ? localOrFullId : `${ext.name}.${localOrFullId}`;
  return runtime.dataTableRenderers.some((renderer) => renderer.id === id) ? id : undefined;
};

const rendererBodyChecks = [
  {
    key: "treeRenderer",
    code: "extension_view_tree_renderer_missing",
    label: "tree renderer",
    resolve: resolveTreeRendererId,
  },
  {
    key: "fileRenderer",
    code: "extension_view_file_renderer_missing",
    label: "file renderer",
    resolve: resolveFileRendererId,
  },
  {
    key: "controlsRenderer",
    code: "extension_view_controls_renderer_missing",
    label: "controls renderer",
    resolve: resolveControlsRendererId,
  },
  {
    key: "dataTableRenderer",
    code: "extension_view_data_table_renderer_missing",
    label: "data table renderer",
    resolve: resolveDataTableRendererId,
  },
] as const;

// Each renderer-backed view references a renderer by local/full id; fail loudly when it
// points at one that was not registered (mirrors the tree/file/controls renderer passes).
const rendererBodyResolves = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  view: Record<string, unknown>,
  id: string,
) => {
  for (const check of rendererBodyChecks) {
    const ref = view[check.key];
    if (typeof ref !== "string" || check.resolve(ext, ref, runtime)) continue;
    runtime.diagnostics.push(
      createDiagnostic({
        code: check.code,
        message: `View "${id}" references unknown ${check.label} "${ref}"`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
        metadata: { contributionId: id, [check.key]: ref },
      }),
    );
    return false;
  }
  return true;
};

const registerViews = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const referencedByModeLayout = modeLayoutViewKeys(source);

  for (const [localId, view] of Object.entries(source.definition.views ?? {})) {
    if (!isRecord(view) || !isLocalizableString(view.title)) continue;
    const id = contributionId(ext, localId);
    const hasWebview = isRecord(view.webview);
    const hasTreeRenderer = typeof view.treeRenderer === "string";
    const hasFileRenderer = typeof view.fileRenderer === "string";
    const hasControlsRenderer = typeof view.controlsRenderer === "string";
    const hasDataTableRenderer = typeof view.dataTableRenderer === "string";

    if (
      [hasWebview, hasTreeRenderer, hasFileRenderer, hasControlsRenderer, hasDataTableRenderer].filter(Boolean)
        .length !== 1
    ) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_view_body_invalid",
          message: `View "${id}" must declare exactly one of webview, treeRenderer, fileRenderer, controlsRenderer, or dataTableRenderer`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    if (!rendererBodyResolves(ext, source, runtime, view, id)) continue;

    const validTarget =
      typeof view.target === "string"
        ? hasCompatibleWorkbenchTarget({
            runtime,
            source: sourceRef(ext, source),
            expected: "view",
            target: view.target,
            contributionId: id,
          })
        : hasCompatibleSlotKind({
            runtime,
            source: sourceRef(ext, source),
            expected: "view",
            slot: view.slot,
            contributionId: id,
          });
    if (!validTarget) {
      continue;
    }
    if (!view.target && !view.slot && !view.resourceKind && !referencedByModeLayout.has(localId)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_view_unreachable",
          message: `View "${id}" must declare a target, a resourceKind, or be referenced by a mode layout`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }
    runtime.views.push({
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: view as RuntimeViewRecord["contribution"],
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

const reportUnsupportedNavigation = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const navigation = (source.definition as Record<string, unknown>).navigation;
  if (!isRecord(navigation)) return;

  for (const [localId, nav] of Object.entries(navigation)) {
    if (!isRecord(nav)) continue;
    const id = contributionId(ext, localId);
    runtime.diagnostics.push(
      createDiagnostic({
        code: "extension_navigation_unsupported",
        message: `Navigation contribution "${id}" uses legacy slots; use treeItems with workbench targets instead`,
        extensionId: ext.id,
        sourcePath: source.sourcePath,
        metadata: { contributionId: id },
      }),
    );
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

export const registerViewLikeContributions = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  registerViews(ext, source, runtime);
  registerRoutes(ext, source, runtime);
  registerTreeItems(ext, source, runtime);
  reportUnsupportedNavigation(ext, source, runtime);
  registerSettingsPanels(ext, source, runtime);
};

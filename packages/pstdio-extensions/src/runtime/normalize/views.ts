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

const registerViews = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const referencedByModeLayout = modeLayoutViewKeys(source);

  for (const [localId, view] of Object.entries(source.definition.views ?? {})) {
    if (!isRecord(view) || typeof view.title !== "string") continue;
    const id = contributionId(ext, localId);
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
    if (!isRecord(item) || typeof item.label !== "string" || !isRecord(item.action)) continue;
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
    if (!isRecord(route) || typeof route.path !== "string" || typeof route.label !== "string") continue;
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
    if (!isRecord(panel) || typeof panel.title !== "string") continue;
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

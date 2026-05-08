import type {
  NormalizedExtension,
  RuntimeNavigationRecord,
  RuntimeRouteRecord,
  RuntimeSettingsPanelRecord,
  RuntimeViewRecord,
} from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { hasCompatibleSlotKind } from "./slot-kind";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.namespace}.${localId}`;

const sourceRef = (ext: NormalizedExtension, source: LoadedExtensionSource) => ({
  extensionId: ext.id,
  sourcePath: source.sourcePath,
});

const registerViews = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, view] of Object.entries(source.definition.views ?? {})) {
    if (!isRecord(view) || typeof view.title !== "string") continue;
    if (
      !hasCompatibleSlotKind({
        runtime,
        source: sourceRef(ext, source),
        expected: "view",
        slot: view.slot,
        contributionId: contributionId(ext, localId),
      })
    ) {
      continue;
    }
    runtime.views.push({
      id: contributionId(ext, localId),
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: view as RuntimeViewRecord["contribution"],
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
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: route as RuntimeRouteRecord["contribution"],
    });
  }
};

const registerNavigation = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, nav] of Object.entries(source.definition.navigation ?? {})) {
    if (!isRecord(nav) || typeof nav.label !== "string") continue;
    if (
      !hasCompatibleSlotKind({
        runtime,
        source: sourceRef(ext, source),
        expected: "navigation",
        slot: nav.slot,
        contributionId: contributionId(ext, localId),
      })
    ) {
      continue;
    }
    runtime.navigation.push({
      id: contributionId(ext, localId),
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: nav as RuntimeNavigationRecord["contribution"],
    });
  }
};

const registerSettingsPanels = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, panel] of Object.entries(source.definition.settingsPanels ?? {})) {
    if (!isRecord(panel) || typeof panel.title !== "string") continue;
    if (
      !hasCompatibleSlotKind({
        runtime,
        source: sourceRef(ext, source),
        expected: "settings",
        slot: panel.slot,
        contributionId: contributionId(ext, localId),
      })
    ) {
      continue;
    }
    runtime.settingsPanels.push({
      id: contributionId(ext, localId),
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
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
  registerNavigation(ext, source, runtime);
  registerSettingsPanels(ext, source, runtime);
};

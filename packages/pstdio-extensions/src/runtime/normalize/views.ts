import type {
  NormalizedExtension,
  RuntimeNavigationRecord,
  RuntimeRouteRecord,
  RuntimeSettingsPanelRecord,
  RuntimeViewRecord,
} from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";

export const registerViewLikeContributions = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
) => {
  for (const [localId, view] of Object.entries(source.definition.views ?? {})) {
    if (!isRecord(view) || typeof view.title !== "string") continue;
    runtime.views.push({
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: view as RuntimeViewRecord["contribution"],
    });
  }

  for (const [localId, route] of Object.entries(source.definition.routes ?? {})) {
    if (!isRecord(route) || typeof route.path !== "string" || typeof route.label !== "string") continue;
    runtime.routes.push({
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: route as RuntimeRouteRecord["contribution"],
    });
  }

  for (const [localId, nav] of Object.entries(source.definition.navigation ?? {})) {
    if (!isRecord(nav) || typeof nav.label !== "string") continue;
    runtime.navigation.push({
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: nav as RuntimeNavigationRecord["contribution"],
    });
  }

  for (const [localId, panel] of Object.entries(source.definition.settingsPanels ?? {})) {
    if (!isRecord(panel) || typeof panel.title !== "string") continue;
    runtime.settingsPanels.push({
      id: `${ext.namespace}.${localId}`,
      localId,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      contribution: panel as RuntimeSettingsPanelRecord["contribution"],
    });
  }
};

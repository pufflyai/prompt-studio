import { workbenchPages } from "@pstdio/sdk/extensions";
import { resolvePageMode } from "../../registries/pages/page-availability";
import type { createWorkbenchInput, WorkbenchCore } from "../../workbench-core-types";
import { resolveUniqueEditorPage } from "../navigation/resource-editor-lookup";
import { getWorkbenchModeLayout } from "../page-runtime/workbench-layout-context";
import { createWorkbenchPageLocationController } from "./page-location-controller";
import {
  createMemoryWorkbenchPageLocationBrowser,
  createMemoryWorkbenchPageLocationPersistence,
} from "./page-location-memory";
export const createPageLocations = (
  input: createWorkbenchInput,
  registry: WorkbenchCore["pages"],
  navigationTrees: WorkbenchCore["navigationTrees"],
  modes: WorkbenchCore["modes"],
  resolveCore: () => WorkbenchCore,
) =>
  createWorkbenchPageLocationController({
    registry,
    browser: input.pageLocationBrowser ?? createMemoryWorkbenchPageLocationBrowser(),
    navigationTrees,
    modes,
    persistence: input.pageLocationPersistence ?? createMemoryWorkbenchPageLocationPersistence(),
    startPage: input.startPage ?? workbenchPages.start,
    resolvePageTarget: (target, current) => {
      const core = resolveCore();
      const resolved = resolveUniqueEditorPage(core, target, current);
      if (!core || resolved.activate !== undefined) return resolved;
      const page = core.pages
        .listPages()
        .find((page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId);
      if (!page) return resolved;
      const modeId = resolvePageMode(page, target.mode, current.activeModeId);
      // Mode restoration keeps the saved selection unless this open selected an editor.
      if (
        current.activeModeId &&
        modeId &&
        modeId !== current.activeModeId &&
        getWorkbenchModeLayout(core, current.projectId, modeId)
      )
        return { ...resolved, activate: [] };
      return resolved;
    },
  });

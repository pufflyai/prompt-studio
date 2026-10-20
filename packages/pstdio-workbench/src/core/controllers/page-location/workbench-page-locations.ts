import { workbenchPages } from "@pstdio/sdk/extensions";
import type { createWorkbenchInput, WorkbenchCore } from "../../workbench-core-types";
import { resolveUniqueEditorPage } from "../navigation/resource-editor-lookup";
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
    resolvePageTarget: (target, modeId) => resolveUniqueEditorPage(resolveCore(), target, modeId),
  });

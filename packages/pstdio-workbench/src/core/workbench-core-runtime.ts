import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import { registerArrangementCommands } from "./controllers/composition/arrangement-commands";
import { connectMainFullscreen } from "./controllers/fullscreen/main-fullscreen";
import { registerKeyboardCommands } from "./controllers/keyboard/keyboard-registration";
import { connectWorkbenchPageBreadcrumbs } from "./controllers/page-location/page-breadcrumbs";
import type { createCoreLayoutCache } from "./controllers/page-runtime/workbench-layout-cache-input";
import { connectModeLayoutCache } from "./controllers/page-runtime/workbench-layout-context";
import { connectWorkbenchCoreState } from "./workbench-core-connections";
import type { createCoreRenderers } from "./workbench-core-renderers";
import type { createWorkbenchInput, WorkbenchCore } from "./workbench-core-types";
import { setWorkbenchRenderers } from "./workbench-renderers";
export const connectWorkbenchRuntime = (
  core: WorkbenchCore,
  input: createWorkbenchInput,
  renderers: ReturnType<typeof createCoreRenderers>,
  layoutCache: ReturnType<typeof createCoreLayoutCache>,
) => {
  setWorkbenchRenderers(core, renderers);
  const disposeFullscreen = connectMainFullscreen(core);
  registerArrangementCommands(core);
  registerKeyboardCommands(core);
  connectModeLayoutCache(core, layoutCache);
  const breadcrumbSources = {
    breadcrumbs: core.breadcrumbs,
    locations: core.pageLocations,
    pages: core.pages,
    navigationTrees: core.navigationTrees,
    modes: core.modes,
  };
  connectWorkbenchPageBreadcrumbs({
    ...breadcrumbSources,
    layout: core.layout,
    resources: input.pageResources ?? defaultPageResourceCodec,
  });
  connectWorkbenchCoreState(core, input);

  return disposeFullscreen;
};

export const listOpenResources = (core: WorkbenchCore, resources: ResourceRef[]) => {
  const resource = core.pages.getContent()?.resource;
  return resource
    ? [...resources.filter((entry) => resourceKey(entry) !== resourceKey(resource)), resource]
    : resources;
};

import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import { registerArrangementCommands } from "./controllers/composition/arrangement-commands";
import { connectMainFullscreen } from "./controllers/fullscreen/main-fullscreen";
import { registerKeyboardCommands } from "./controllers/keyboard/keyboard-registration";
import { connectWorkbenchPageBreadcrumbs } from "./controllers/page-location/page-breadcrumbs";
import type { createCoreLayoutCache } from "./controllers/page-runtime/workbench-layout-cache-input";
import { connectModeLayoutCache } from "./controllers/page-runtime/workbench-layout-context";
import { runWorkbenchEffect } from "./shared/workbench-effect";
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
  const disposeKeyboard = registerKeyboardCommands(core);
  const layout = connectModeLayoutCache(core, layoutCache);
  const breadcrumbSources = {
    breadcrumbs: core.breadcrumbs,
    locations: core.pageLocations,
    pages: core.pages,
    navigationTrees: core.navigationTrees,
    modes: core.modes,
  };
  const breadcrumbs = connectWorkbenchPageBreadcrumbs({
    ...breadcrumbSources,
    layout: core.layout,
    resources: input.pageResources ?? defaultPageResourceCodec,
  });
  const state = connectWorkbenchCoreState(core, input);

  return () => {
    for (const release of [
      () => state.dispose(),
      () => breadcrumbs.dispose(),
      () => layout.dispose(),
      disposeKeyboard,
      disposeFullscreen,
    ])
      runWorkbenchEffect("runtime connection disposal", release);
  };
};

export const listOpenResources = (core: WorkbenchCore, resources: ResourceRef[]) => {
  const resource = core.pages.getContent()?.resource;
  return resource
    ? [...resources.filter((entry) => resourceKey(entry) !== resourceKey(resource)), resource]
    : resources;
};

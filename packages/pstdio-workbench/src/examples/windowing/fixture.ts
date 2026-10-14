import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../core";
import { createBoomboxWorkbench } from "../showcases/boombox";
import { createKilnWorkbench } from "../showcases/kiln";
import { createWindowingPersistence } from "./adapters";
import { registerContextNavigation } from "./context-navigation";
import type { WindowingFixtureOptions } from "./fixture-options";
import { createWindowingLifecycleProbe } from "./lifecycle-probe";
import { registerWindowingModule } from "./module";
import { registerAvailabilityPages } from "./page-modes";
import { createWindowingResources, windowingPages } from "./resources";

export type WindowingMode = "windowing" | "boombox" | "kiln";

export const createWindowingFixture = (mode: WindowingMode = "windowing", options: WindowingFixtureOptions = {}) => {
  const resources = createWindowingResources();
  const persistence = createWindowingPersistence();
  const probe = createWindowingLifecycleProbe();
  const deletedResources: import("@pstdio/sdk/extensions").ResourceRef[] = [];
  let registrations: ReturnType<typeof registerWindowingModule> | undefined;
  const create = () => {
    if (mode === "boombox") return createBoomboxWorkbench();
    if (mode === "kiln") return createKilnWorkbench();
    const savedLocation = persistence.pageLocation.load("windowing-project");
    const workbench = createWorkbench({
      startPage: windowingPages.workspaces,
      initialSidePanelMode: "attached",
      defaultPanelOpenByRegionId: { side: true, secondary: true, sidenav: options.contextNavigation ?? false },
      layoutPersistence: persistence.layout,
      pageLocationPersistence: persistence.pageLocation,
    });
    registrations = registerWindowingModule(workbench, resources, probe, options);
    options.registerPages?.(workbench);
    if (options.pageModes) registerAvailabilityPages(workbench);
    if (options.contextNavigation) registerContextNavigation(workbench, resources);
    workbench.pageLocations.setProject("windowing-project");
    for (const resource of deletedResources) workbench.resources.removed(resource);
    workbench.pageLocations.switchProject("windowing-project");
    if (!savedLocation && !options.pageModes)
      workbench.pageLocations.navigate({
        kind: "page",
        page: windowingPages.workspace,
        resource: resources.workspaces[0],
      });
    return workbench;
  };
  let workbench = create();
  return {
    mode,
    pageModes: options.pageModes,
    contextNavigation: options.contextNavigation,
    sessionStarts: options.sessionStarts,
    resources,
    persistence,
    probe,
    removalControls: options.removalControls,
    removeContribution(kind: "mode" | "workspace" | "panel") {
      registrations?.[kind].dispose();
    },
    removeResource(resource: import("@pstdio/sdk/extensions").ResourceRef) {
      deletedResources.push(resource);
      workbench.resources.removed(resource);
    },
    startSession(workspace: ResourceRef) {
      const resource = resources.startSession(workspace);
      probe.start(resource);
      return resource;
    },
    get workbench() {
      return workbench;
    },
    async reload() {
      await workbench.dispose();
      workbench = create();
      return workbench;
    },
    dispose: () => workbench.dispose(),
  };
};

export type WindowingFixture = ReturnType<typeof createWindowingFixture>;

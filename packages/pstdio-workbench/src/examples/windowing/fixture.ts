import { createWorkbench } from "../../core";
import { createBoomboxWorkbench } from "../showcases/boombox";
import { createKilnWorkbench } from "../showcases/kiln";
import { createWindowingPersistence } from "./adapters";
import type { WindowingFixtureOptions } from "./fixture-options";
import { createWindowingLifecycleProbe } from "./lifecycle-probe";
import { registerWindowingModule } from "./module";
import { createWindowingResources, windowingPages } from "./resources";

export type WindowingMode = "windowing" | "boombox" | "kiln";

export const createWindowingFixture = (mode: WindowingMode = "windowing", options: WindowingFixtureOptions = {}) => {
  const resources = createWindowingResources();
  const persistence = createWindowingPersistence();
  const probe = createWindowingLifecycleProbe();
  const create = () => {
    if (mode === "boombox") return createBoomboxWorkbench();
    if (mode === "kiln") return createKilnWorkbench();
    const savedLocation = persistence.pageLocation.load("windowing-project");
    const workbench = createWorkbench({
      startPage: windowingPages.workspaces,
      initialSidePanelMode: "attached",
      defaultPanelOpenByRegionId: { side: true, secondary: true },
      layoutPersistence: persistence.layout,
      pageLocationPersistence: persistence.pageLocation,
    });
    registerWindowingModule(workbench, resources, probe, options);
    workbench.pageLocations.switchProject("windowing-project");
    if (!savedLocation)
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
    resources,
    persistence,
    probe,
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

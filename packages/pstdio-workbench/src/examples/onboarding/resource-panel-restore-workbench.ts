import {
  createWorkbenchCore,
  type LayoutPersistenceAdapter,
  type WorkbenchPanelsPersistenceAdapter,
  type WorkbenchRegion,
} from "../../core";
import { createPanelCompositionModule, resources } from "./panel-compositions-module";

const RESOURCE_SCOPE_PREFIX = "project/demo/mode/locations/resource/";
const projectOwnedRegions: WorkbenchRegion[] = [
  "nav",
  "sidenav-header",
  "sidenav",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
];

const createMemoryPersistence = () => {
  const layouts = new Map<string, Parameters<LayoutPersistenceAdapter["setLayout"]>[0]>();
  const panels = new Map<string, Parameters<WorkbenchPanelsPersistenceAdapter["setPanelStates"]>[0]>();
  return {
    layout: {
      getLayout: (scope) => layouts.get(scope ?? "global"),
      setLayout: (state, scope) => layouts.set(scope ?? "global", state),
    } satisfies LayoutPersistenceAdapter,
    panels: {
      getPanelStates: (scope) => panels.get(scope ?? "global"),
      setPanelStates: (state, scope) => panels.set(scope ?? "global", state),
    } satisfies WorkbenchPanelsPersistenceAdapter,
  };
};

const openPanelTabs = (workbench: ReturnType<typeof createWorkbenchCore>, suffix: "notes" | "reports") => {
  for (const region of ["main", "secondary", "side"] as const) {
    workbench.layout.openPanel(`onboarding.panel-composition.${region}.${suffix}`);
  }
};

export const createResourceIsolatedPanelCompositionWorkbench = () => {
  const persistence = createMemoryPersistence();
  const workbench = createWorkbenchCore({
    layoutPersistence: persistence.layout,
    panelsPersistence: persistence.panels,
  });
  workbench.registerModule(createPanelCompositionModule("all-panels", false));
  workbench.history.setPersistenceScope("project:demo");

  const alpha = resources[0]!;
  const alphaScope = `${RESOURCE_SCOPE_PREFIX}${alpha.uri}`;
  workbench.panels.setPersistenceScope(alphaScope);
  workbench.layout.setPersistenceScope(alphaScope);
  void workbench.resources.openResource(alpha);
  openPanelTabs(workbench, "notes");
  openPanelTabs(workbench, "reports");
  workbench.layout.setRegionSize("secondary", 240);

  const beta = resources[1]!;
  const betaScope = `${RESOURCE_SCOPE_PREFIX}${beta.uri}`;
  workbench.panels.setPersistenceScope(betaScope);
  workbench.layout.setPersistenceScope(betaScope, {
    carryRegionState: projectOwnedRegions,
  });
  void workbench.resources.openResource(beta);
  workbench.layout.openPanel("onboarding.panel-composition.main.notes");
  workbench.layout.openPanel("onboarding.panel-composition.secondary.reports");
  workbench.layout.setRegionSize("secondary", 360);
  workbench.panels.setOpen("secondary", false);

  workbench.panels.setPersistenceScope(alphaScope);
  workbench.layout.setPersistenceScope(alphaScope, {
    carryRegionState: projectOwnedRegions,
  });
  return workbench;
};

import type { WorkbenchCore } from "../../core";
import { type WindowingResources, windowingPages } from "./resources";

export const registerContextNavigation = (workbench: WorkbenchCore, resources: WindowingResources) => {
  workbench.views.registerView({
    id: "windowing.navigation",
    title: "Project navigation",
    body: {
      kind: "tree",
      getChildren: () => [],
      getBody: () => [
        {
          id: "workspaces",
          nodes: resources.workspaces.map((resource) => ({
            id: resource.id,
            label: resource.label!,
            resource,
            selected: workbench.pages.store.getState().location?.resource?.id === resource.id,
            target: { kind: "page" as const, page: windowingPages.workspace, resource },
          })),
        },
      ],
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "windowing.navigation",
    region: "sidenav",
    item: { kind: "view", view: { kind: "view", id: "windowing.navigation" }, presence: "fixed" },
  });
};

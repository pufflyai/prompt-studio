import { workbenchModes } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "../../core";

// The dashboard supplies this host navigation UI when an extension is installed.
export const registerPreviewNavigation = (workbench: WorkbenchCore) => {
  const id = "storybook.navigation";
  const owner = workbenchModes.project;
  workbench.views.registerView({
    id,
    title: "Learn",
    body: {
      kind: "tree",
      defaultExpandedSectionIds: workbench.navigationTrees.getDefaultExpandedSectionIds(owner),
      getBody: () => workbench.navigationTrees.getSections(owner),
      getChildren: (node, context) => workbench.navigationTrees.getChildren(node, context),
    },
  });
  workbench.shellPlacements.registerPlacement({
    id,
    item: { kind: "view", view: { kind: "view", id }, presence: "fixed" },
    region: "sidenav",
  });
};

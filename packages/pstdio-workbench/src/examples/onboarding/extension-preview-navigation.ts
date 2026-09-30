import type { WorkbenchCore } from "../../core";
import { createLevelNavigation } from "../../core";

// The dashboard supplies this host navigation UI when an extension is installed.
export const registerPreviewNavigation = (workbench: WorkbenchCore) => {
  const id = "storybook.navigation";
  const navigation = createLevelNavigation(workbench);
  workbench.views.registerView({
    id,
    title: "Learn",
    body: {
      kind: "tree",
      defaultExpandedSectionIds: navigation.getDefaultExpandedSectionIds(),
      getReadKey: () => navigation.getReadKey(),
      getHeader: (context) => navigation.getSections("header", context.signal),
      getBody: (context) => navigation.getSections("content", context.signal),
      getFooter: (context) => navigation.getSections("footer", context.signal),
      getChildren: (node, context) => workbench.navigationTrees.getChildren(node, context),
    },
  });
  // Opening a level page changes which owners fill the tree.
  workbench.pages.store.subscribeSelector(
    (state) => state.location,
    () => workbench.views.refreshView(id),
  );
  workbench.shellPlacements.registerPlacement({
    id,
    item: { kind: "view", view: { kind: "view", id }, presence: "fixed" },
    region: "sidenav",
  });
};

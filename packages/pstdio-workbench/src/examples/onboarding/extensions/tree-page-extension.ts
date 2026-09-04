import { defineExtension, defineNavigationItem, definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";

export const guideTree = defineView({
  id: "guide-tree",
  title: "Guide",
  body: {
    kind: "tree",
    defaultExpandedSectionIds: ["learn"],
    body: async () => [
      {
        id: "learn",
        label: "Learn Prompt Studio",
        nodes: [
          { id: "start", label: "Getting started", icon: "BookOpen", selected: true },
          { id: "pages", label: "Pages", icon: "PanelsTopLeft" },
          { id: "views", label: "Views", icon: "LayoutPanelTop" },
        ],
      },
    ],
  },
});

export const guidePage = definePage({
  id: "guide",
  title: "Guide",
  path: "guide",
  mode: workbenchModes.project,
  slots: [{ id: "content", role: "primary", region: "main", view: guideTree.ref }],
});

const guideNavigation = defineNavigationItem({
  id: "guide",
  owner: workbenchModes.project,
  slot: "content",
  group: "Learn",
  label: "Guide",
  icon: "BookOpen",
  action: { kind: "page", page: guidePage.ref },
});

export default defineExtension({
  views: [guideTree],
  pages: [guidePage],
  navigationItems: [guideNavigation],
});

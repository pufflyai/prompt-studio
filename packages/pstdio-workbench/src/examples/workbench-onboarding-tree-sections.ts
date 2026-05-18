import type { TreeViewSection } from "../core";

export const onboardingTreeSections = [
  {
    id: "concepts",
    label: "Concepts",
    nodes: [
      {
        id: "areas",
        label: "Areas",
        description: "Named layout targets for contributed UI.",
        icon: "PanelLeft",
        children: [
          { id: "areas.main", label: "main", description: "Primary work area.", icon: "PanelTop" },
          { id: "areas.left", label: "left", description: "Tree-hosting sidebar.", icon: "PanelLeft" },
          { id: "areas.status", label: "status", description: "Persistent bottom strip.", icon: "PanelBottom" },
        ],
      },
      {
        id: "widgets",
        label: "Widgets",
        description: "Registered views that can be placed into areas.",
        icon: "PanelsTopLeft",
        children: [
          { id: "widgets.renderer", label: "rendererId", description: "Connects a widget to React.", icon: "Code" },
          { id: "widgets.singleton", label: "singleton", description: "Reuses one placement.", icon: "Pin" },
        ],
      },
    ],
  },
  {
    id: "surfaces",
    label: "Surfaces",
    nodes: [
      {
        id: "menus",
        label: "Menus",
        description: "Expose registered commands in predictable slots.",
        icon: "ListTree",
      },
      {
        id: "commands",
        label: "Commands",
        description: "Actions that can be reused by menus, keys, and trees.",
        icon: "Terminal",
      },
    ],
  },
] satisfies TreeViewSection[];

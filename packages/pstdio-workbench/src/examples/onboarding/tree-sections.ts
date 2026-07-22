import type { TreeViewSection } from "../../core";

export const onboardingTreeSections = [
  {
    id: "concepts",
    label: "Concepts",
    nodes: [
      {
        id: "regions",
        label: "Regions",
        description: "Named layout targets for contributed UI.",
        icon: "PanelLeft",
        children: [
          { id: "regions.main", label: "main", description: "Primary work region.", icon: "PanelTop" },
          { id: "regions.sidenav", label: "sidenav", description: "Tree-hosting sidenav.", icon: "PanelLeft" },
          { id: "regions.status", label: "status", description: "Persistent bottom strip.", icon: "PanelBottom" },
        ],
      },
      {
        id: "widgets",
        label: "Widgets",
        description: "Registered views that can be placed into regions.",
        icon: "PanelsTopLeft",
        children: [
          { id: "widgets.renderer", label: "rendererId", description: "Connects a widget to React.", icon: "Code" },
          {
            id: "widgets.singleton",
            label: "singleton",
            description: "One placement total for durable tool views.",
            icon: "Pin",
          },
          {
            id: "widgets.reuse",
            label: "reuse",
            description: "Reopen resource tabs or opt into duplicate placements.",
            icon: "RefreshCw",
          },
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

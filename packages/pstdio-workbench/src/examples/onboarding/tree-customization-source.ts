export const treeCustomizationSource = `import type {
  TreeNode,
  TreeViewSection,
  WorkbenchModuleContribution,
} from "pstdio-workbench/core";

const treeBody = (): TreeViewSection[] => [
  {
    id: "workspace",
    label: "Workspace",
    nodes: [
      {
        id: "overview",
        label: "Overview",
        icon: "FileText",
        canHide: false,
      },
      { id: "daily", label: "Daily brief", icon: "FileText" },
      {
        id: "archive",
        label: "Archive",
        icon: "Archive",
        hiddenByDefault: true,
      },
    ],
  },
  {
    id: "experiments",
    label: "Experiments",
    hiddenByDefault: true,
    nodes: [{ id: "experiment", label: "Experiment", icon: "FlaskConical" }],
  },
];

export const createTreeCustomizationModule = (): WorkbenchModuleContribution => ({
  id: "docs.tree-customization",
  activate(ctx) {
    ctx.renderers.registerTreeRenderer({
      id: "docs.customizable-tree",
      title: "Customizable tree",
      defaultExpandedSectionIds: ["workspace", "experiments"],
      getBody: treeBody,
      getChildren: () => [],
    });

    ctx.layout.registerWidget({
      id: "docs.customizable-tree",
      title: "Tree",
      area: "left",
      rendererId: "docs.customizable-tree",
    });

    ctx.layout.openWidget("docs.customizable-tree");
  },
});`;

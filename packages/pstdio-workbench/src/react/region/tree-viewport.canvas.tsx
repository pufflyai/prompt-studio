import { Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createTreeWorkbench = (menu: boolean) => {
  const page = { kind: "page", extensionId: "storybook", id: "tree-viewport" } as const;
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: "files", label: "Files", activate: () => undefined });
  workbench.commands.registerCommand(
    { id: "select-file", label: "Select file" },
    {
      execute: (args: { path: string }) => workbench.treeViews.setSelectedNode("files", args.path),
    },
  );
  workbench.views.registerView({
    id: "files",
    title: "Workspace files",
    body: {
      kind: "tree",
      getChildren: () => [],
      getBody: () => [
        {
          id: "files",
          nodes: Array.from({ length: 1000 }, (_, index) => {
            const path = `file-${String(index).padStart(4, "0")}.ts`;
            return {
              id: path,
              label: path,
              rowVariant: "file" as const,
              target: { kind: "command" as const, commandId: "select-file", args: { path } },
            };
          }),
        },
      ],
    },
  });
  workbench.views.registerView({
    id: "editor",
    title: "Editor",
    body: { kind: "react", render: () => <Text>Select a file</Text> },
  });
  if (menu)
    workbench.viewMenus.registerViewMenu({ id: "file-menu", ownerViewId: "editor", viewId: "files", side: "left" });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Files",
    path: "files",
    modeId: "files",
    main: { kind: "view", view: { kind: "view", id: menu ? "editor" : "files" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.switchProject("tree-viewport");
  workbench.pageLocations.navigate({ kind: "page", page });
  return workbench;
};
const meta = {
  title: "pstdio-workbench/File tree/Viewport",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
  tags: ["!manifest"],
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const InPanelMenu: Story = {
  id: "pstdio-workbench-file-tree-viewport--in-panel-menu",
  args: { workbench: createTreeWorkbench(true) },
};
export const InMainPanel: Story = {
  id: "pstdio-workbench-file-tree-viewport--in-main-panel",
  args: { workbench: createTreeWorkbench(false) },
};

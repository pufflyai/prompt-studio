import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const StructureLoading = () => {
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    const pending = Promise.withResolvers<void>();
    workbench.views.registerView({
      id: "navigation",
      title: "Navigation",
      body: {
        kind: "tree",
        defaultExpandedSectionIds: ["Files", "Workspaces", "Sessions"],
        getStructure: () => [
          { id: "ticket", nodes: [{ id: "self", label: "T-1 Ticket" }] },
          ...["Files", "Workspaces", "Sessions"].map((label) => ({ id: label, label, loading: true, nodes: [] })),
        ],
        getBody: async () => {
          await pending.promise;
          return [{ id: "Files", label: "Files", nodes: [{ id: "readme", label: "README.md" }] }];
        },
        getChildren: () => [],
      },
    });
    workbench.views.registerView({
      id: "controls",
      title: "Controls",
      body: {
        kind: "react",
        render: () => (
          <Stack p="md">
            <Button onClick={() => pending.resolve()}>Complete fetch</Button>
          </Stack>
        ),
      },
    });
    workbench.modes.registerMode({ id: "project", activate() {} });
    workbench.pages.registerPage({
      id: "ticket",
      ref: { kind: "page", id: "ticket", extensionId: "preview" },
      title: "Ticket",
      path: "ticket",
      modeId: "project",
      slots: [],
      main: { kind: "view", view: { kind: "view", id: "controls" }, cardinality: "one" },
    });
    workbench.shellPlacements.registerPlacement({
      id: "navigation",
      region: "sidenav",
      item: {
        kind: "view",
        presence: "fixed",
        view: { kind: "view", id: "navigation" },
      },
    });
    workbench.pageLocations.setProject("project");
    workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "ticket", extensionId: "preview" } });
    return workbench;
  });
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Structure before contents",
  component: StructureLoading,
  fullscreen: true,
} satisfies CanvasMeta<typeof StructureLoading>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const PendingContents: Story = {
  id: "pstdio-workbench-guides-structure-before-contents--pending-contents",
};
const GroupMenuDuringLoading = () => {
  const [{ workbench, pending }] = useState(() => {
    const workbench = createWorkbench();
    const pending = Promise.withResolvers<void>();
    const navigation = { id: "navigation", nodes: [{ id: "search", label: "Search", canHide: true }] };
    workbench.views.registerView({
      id: "group-navigation",
      title: "Group navigation",
      body: {
        kind: "tree",
        getStructure: () => [navigation],
        getChildren: () => [],
        getBody: async () => {
          await pending.promise;
          return [navigation, { id: "files", nodes: [{ id: "folder", label: "Folder", collapsible: true }] }];
        },
      },
    });
    workbench.shellPlacements.registerPlacement({
      id: "group-navigation",
      region: "sidenav",
      item: { kind: "view", presence: "fixed", view: { kind: "view", id: "group-navigation" } },
    });
    workbench.pageLocations.setProject("groups-loading");
    return { workbench, pending };
  });
  return (
    <div
      onContextMenuCapture={(event) => {
        if ((event.target as HTMLElement).textContent === "Research") pending.resolve();
      }}
    >
      <WorkbenchStory workbench={workbench} />
    </div>
  );
};
export const GroupMenuWhileContentsArrive: Story = {
  id: "pstdio-workbench-guides-structure-before-contents--group-menu-while-contents-arrive",
  render: () => <GroupMenuDuringLoading />,
};

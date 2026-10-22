import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
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
      ref: { kind: "page", id: "ticket", extensionId: "storybook" },
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
    workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", id: "ticket", extensionId: "storybook" } });
    return workbench;
  });
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Structure before contents",
  component: StructureLoading,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StructureLoading>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PendingContents: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("T-1 Ticket")).toBeVisible();
    for (const label of ["Files", "Workspaces", "Sessions"])
      await expect(canvas.getByText(label, { exact: true })).toBeVisible();
    await expect(canvas.getAllByText("Loading…")).toHaveLength(3);
    await expect(canvas.queryByText("No files")).not.toBeInTheDocument();
    await userEvent.click(await canvas.findByRole("button", { name: "Complete fetch" }));
    await expect(await canvas.findByText("README.md")).toBeVisible();
    await expect(canvas.queryByText("Loading…")).not.toBeInTheDocument();
  },
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
  tags: ["!manifest"],
  render: () => <GroupMenuDuringLoading />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    fireEvent.contextMenu(await canvas.findByText("Search", { exact: true }));
    await userEvent.click(await body.findByRole("menuitem", { name: "New group" }));
    const input = await canvas.findByRole("textbox", { name: "Group name" });
    await userEvent.type(input, "Research{Enter}");
    fireEvent.contextMenu(await canvas.findByText("Research", { exact: true }));
    await expect(await canvas.findByText("Folder", { exact: true })).toBeVisible();
    await userEvent.click(await body.findByRole("menuitem", { name: "Rename group" }));
    const rename = await canvas.findByRole("textbox", { name: "Group name" });
    await expect(rename).toHaveFocus();
    await userEvent.clear(rename);
    await userEvent.type(rename, "Product research{Enter}");
    await expect(await canvas.findByText("Product research", { exact: true })).toBeVisible();
  },
};

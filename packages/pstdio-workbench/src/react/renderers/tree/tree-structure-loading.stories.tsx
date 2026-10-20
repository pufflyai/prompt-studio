import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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

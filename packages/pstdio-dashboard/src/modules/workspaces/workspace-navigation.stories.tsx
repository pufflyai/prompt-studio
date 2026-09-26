import { Box } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { dashboardCommandIds } from "@/shared/app/commands";
import { workspaceNavigationNode } from "./workspace-navigation";

const WorkspaceNavigationStory = (props: { providers: WorkspaceProviderDescriptor[] }) => {
  const { providers } = props;
  const [workbench] = useState(() => {
    const page = { kind: "page", extensionId: "storybook", id: "workspace-navigation" } as const;
    const next = createWorkbench({ startPage: page });
    next.modes.registerMode({ id: "workspace-navigation", label: "Workspaces", activate: () => undefined });
    for (const [id, label] of [
      [dashboardCommandIds.openWorkspaces, "Open workspaces"],
      [dashboardCommandIds.createWorkspace, "New workspace"],
    ]) {
      next.commands.registerCommand({ id, label }, { execute: () => undefined });
    }
    next.views.registerView({
      id: "workspace-navigation",
      title: "Workspace navigation",
      body: {
        kind: "tree",
        getBody: () => [
          { id: "navigation.root", nodes: [{ ...workspaceNavigationNode(providers), hiddenByDefault: false }] },
        ],
        getChildren: () => [],
      },
    });
    next.pages.registerPage({
      id: page.id,
      ref: page,
      title: "Workspace navigation",
      path: "workspace-navigation",
      modeId: "workspace-navigation",
      main: { kind: "view", view: { kind: "view", id: "workspace-navigation" }, cardinality: "one" },
      slots: [],
    });
    next.pageLocations.switchProject("storybook-workspace-navigation");
    next.pageLocations.navigate({ kind: "page", page });
    return next;
  });
  return (
    <Box h="100dvh">
      <Workbench workbench={workbench} />
    </Box>
  );
};

const meta = {
  title: "Dashboard/Workspace navigation",
  component: WorkspaceNavigationStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkspaceNavigationStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoCreationProviders: Story = {
  args: { providers: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(await canvas.findByRole("option", { name: /^Workspaces$/ }));
    await expect(canvas.queryByRole("button", { name: "New workspace" })).toBeNull();
  },
};

export const GitProvider: Story = {
  args: { providers: [{ id: "pstdio.worktree", label: "Git worktree", params: {} }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(await canvas.findByRole("option", { name: /^Workspaces/ }));
    await expect(canvas.getByRole("button", { name: "New workspace" })).toBeVisible();
  },
};

export const CloudProvider: Story = {
  ...GitProvider,
  args: { providers: [{ id: "example.cloud", label: "Cloud workspace", params: {} }] },
};

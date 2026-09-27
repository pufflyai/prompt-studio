import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { createWorkbench, headerTrailingMenuPath } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPanelWorkbench = (
  options: { changes?: boolean; collapsed?: boolean; action?: boolean; panelResource?: boolean } = {},
) => {
  const page = { kind: "page", extensionId: "storybook", id: "panel-header" } as const;
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: "panel-header", label: "Panel header", activate: () => undefined });
  for (const [id, title] of [
    ["files", "Files"],
    ["changes", "Changes"],
    ["file-tree", "File tree"],
  ]) {
    workbench.views.registerView({
      id,
      title,
      body: {
        kind: "react",
        render: () => (
          <Box p="md">
            <Text>{title} content</Text>
          </Box>
        ),
      },
    });
  }
  workbench.viewMenus.registerViewMenu({ id: "file-tree", ownerViewId: "files", viewId: "file-tree", side: "left" });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    title: "Panel header",
    path: "panel-header",
    modeId: "panel-header",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "files" } },
    slots: [
      { id: "files", region: "main", item: { kind: "view", view: { kind: "view", id: "files" }, presence: "fixed" } },
      {
        id: "changes",
        region: "main",
        isAvailable: () => options.changes === true,
        item: { kind: "view", view: { kind: "view", id: "changes" }, presence: "fixed" },
      },
    ],
  });
  if (options.action) {
    workbench.commands.registerCommand({ id: "refresh", label: "Refresh files" }, { execute: () => undefined });
    workbench.layout.registerMenuItem(headerTrailingMenuPath("main"), {
      commandId: "refresh",
      group: "primary",
      ...(options.panelResource ? { when: 'workbench.resource.type == "file"' } : {}),
    });
  }
  workbench.pageLocations.switchProject("storybook-panel-header");
  workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "workspace", id: "workspace-1" } });
  if (options.panelResource) {
    const panel = workbench.layout.listPanelInstances("main")[0];
    if (panel) workbench.layout.updatePanel(panel.instanceId, { resource: { type: "file", id: "notes.md" } });
  }
  if (options.collapsed) {
    const menu = workbench.layout.listPanelInstances("main-left-menu")[0];
    if (menu) workbench.panelMenuState.setOpen(`panel-menu:${menu.instanceId}`, false);
  }
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel header visibility",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleAvailableFixedPanel: Story = {
  args: { workbench: createPanelWorkbench() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Files content")).toBeVisible();
    await expect(canvas.getByText("File tree content")).toBeVisible();
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
    await expect(canvasElement.querySelector('[data-workbench-panel-header="main"]')).not.toBeVisible();
  },
};

export const MultipleAvailableFixedPanels: Story = {
  args: { workbench: createPanelWorkbench({ changes: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("tab", { name: "Files" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Changes" })).toBeVisible();
  },
};

export const CollapsedMenuWithoutTabs: Story = {
  args: { workbench: createPanelWorkbench({ collapsed: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Open Main left menu" })).toBeVisible();
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
  },
};

export const HeaderActionWithoutTabs: Story = {
  args: { workbench: createPanelWorkbench({ action: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Refresh files" })).toBeVisible();
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
  },
};

export const HeaderActionForPanelResource: Story = {
  ...HeaderActionWithoutTabs,
  args: { workbench: createPanelWorkbench({ action: true, panelResource: true }) },
};

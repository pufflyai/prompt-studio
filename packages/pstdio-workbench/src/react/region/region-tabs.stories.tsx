import { Box, Text } from "@chakra-ui/react";
import type { PageRef } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import {
  createWorkbench,
  type WorkbenchPageSlot,
  workbenchPanelRegions,
  workbenchRegionTabLeadingMenuPath,
} from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPanelWorkbench = (
  options: {
    alwaysShowTabs?: boolean;
    multiple?: boolean;
    actions?: boolean;
    closable?: boolean;
    resource?: boolean;
  } = {},
) => {
  const page: PageRef = { extensionId: "storybook", kind: "page", id: "panel-tabs" };
  const workbench = createWorkbench({
    startPage: page,
    initialSidePanelMode: "attached",
    defaultPanelOpenByRegionId: { secondary: true },
    regionSettings: Object.fromEntries(
      workbenchPanelRegions.map((region) => [region, { alwaysShowTabs: options.alwaysShowTabs }]),
    ),
  });
  workbench.modes.registerMode({ id: "panel-tabs", label: "Panel tabs", activate: () => undefined });
  for (const region of workbenchPanelRegions) {
    for (const suffix of ["first", "second"]) {
      const id = `${region}.${suffix}`;
      workbench.views.registerView({
        id,
        title: `${region} ${suffix}`,
        body: {
          kind: "react",
          render: () => (
            <Box p="md">
              <Text>{id} content</Text>
            </Box>
          ),
        },
      });
    }
    if (options.actions) {
      const id = `${region}.refresh`;
      workbench.commands.registerCommand(
        { id, label: `Refresh ${region}`, icon: "refresh-cw" },
        { execute: () => undefined },
      );
      workbench.layout.registerMenuItem(workbenchRegionTabLeadingMenuPath(region), { commandId: id });
    }
  }
  const slots: WorkbenchPageSlot[] = workbenchPanelRegions.flatMap<WorkbenchPageSlot>((region) => [
    region === "main"
      ? { id: "main.first", role: "primary", region: "main", viewId: "main.first" }
      : {
          id: `${region}.first`,
          role: "auxiliary",
          region,
          viewId: `${region}.first`,
          presence: options.closable ? "open" : "fixed",
        },
    ...(options.multiple
      ? [
          {
            id: `${region}.second`,
            role: "auxiliary" as const,
            region,
            viewId: `${region}.second`,
            presence: "open" as const,
          },
        ]
      : []),
  ]);
  workbench.pages.registerPage({
    id: "panel-tabs",
    ref: page,
    title: "Panel tabs",
    path: "panel-tabs",
    modeId: "panel-tabs",
    slots,
  });
  const resourcePage = { ...page, id: "document" };
  workbench.pages.registerPage({
    id: "document",
    ref: resourcePage,
    title: "Document",
    path: "document",
    modeId: "panel-tabs",
    parentId: "panel-tabs",
    slots: slots.map((slot) =>
      slot.role === "primary"
        ? {
            id: slot.id,
            role: "primary",
            region: "main",
            binding: { resourceKinds: ["document"], viewId: "main.first", cardinality: "one" },
          }
        : slot,
    ),
  });
  workbench.pageLocations.switchProject("storybook-panel-tabs");
  if (options.resource) {
    workbench.pageLocations.navigate({ kind: "page", page: resourcePage, resource: { type: "document", id: "one" } });
  }
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel tabs",
  component: WorkbenchStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A lone panel hides its tab. alwaysShowTabs keeps a single tab and its Close button visible. Header actions remain available without tabs.",
      },
    },
  },
} satisfies Meta<typeof WorkbenchStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleItems: Story = {
  args: { workbench: createPanelWorkbench() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const region of workbenchPanelRegions) {
      await expect(await canvas.findByText(`${region}.first content`)).toBeVisible();
    }
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
  },
};
export const AlwaysShowTabs: Story = {
  args: { workbench: createPanelWorkbench({ alwaysShowTabs: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const region of workbenchPanelRegions) {
      await expect(await canvas.findByRole("tab", { name: `${region} first` })).toBeVisible();
    }
  },
};
export const SingleResourcePage: Story = {
  args: { workbench: createPanelWorkbench({ resource: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("main.first content")).toBeVisible();
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
  },
};
export const CloseResourcePage: Story = {
  args: { workbench: createPanelWorkbench({ resource: true, alwaysShowTabs: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Close main first" }));
    await expect(canvas.queryByRole("button", { name: "Close main first" })).toBeNull();
    await expect(canvas.getByText("main.first content")).toBeVisible();
  },
};
export const SingleClosablePanel: Story = {
  args: { workbench: createPanelWorkbench({ closable: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const region of workbenchPanelRegions) {
      await expect(await canvas.findByText(`${region}.first content`)).toBeVisible();
    }
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
  },
};
export const AlwaysShowClosablePanel: Story = {
  args: { workbench: createPanelWorkbench({ closable: true, alwaysShowTabs: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const close = await canvas.findByRole("button", { name: "Close side first" });
    await expect(close).toBeVisible();
    await userEvent.click(close);
    await expect(canvas.queryByText("side.first content")).not.toBeInTheDocument();
    await expect(canvas.getByText("main.first content")).toBeVisible();
  },
};
export const MultipleItems: Story = {
  args: { workbench: createPanelWorkbench({ multiple: true, closable: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const region of workbenchPanelRegions) {
      await userEvent.click(await canvas.findByRole("tab", { name: `${region} second` }));
      await expect(await canvas.findByText(`${region}.second content`)).toBeVisible();
      await userEvent.click(canvas.getByRole("button", { name: `Close ${region} second` }));
      await expect(await canvas.findByText(`${region}.first content`)).toBeVisible();
      await expect(canvas.queryByRole("tab", { name: `${region} first` })).not.toBeInTheDocument();
    }
  },
};
export const ActionsWithoutTabs: Story = {
  args: { workbench: createPanelWorkbench({ actions: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const region of workbenchPanelRegions) {
      await expect(await canvas.findByRole("button", { name: `Refresh ${region}` })).toBeVisible();
    }
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
  },
};

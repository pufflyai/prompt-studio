import { Box, Text } from "@chakra-ui/react";
import type { PageRef } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench, workbenchPanelRegions, workbenchRegionTabLeadingMenuPath } from "../../core";
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
  workbench.pages.registerPage({
    id: "panel-tabs",
    ref: page,
    title: "Panel tabs",
    path: "panel-tabs",
    modeId: "panel-tabs",
    slots: workbenchPanelRegions.flatMap((region) => [
      {
        id: `${region}.first`,
        region,
        viewId: `${region}.first`,
        ...(region === "main"
          ? {
              role: "primary" as const,
              ...(options.resource
                ? { binding: { resourceKinds: ["document"], viewId: `${region}.first`, cardinality: "one" as const } }
                : {}),
            }
          : { role: "auxiliary" as const, presence: options.closable ? ("open" as const) : ("fixed" as const) }),
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
    ]),
  });
  workbench.pageLocations.switchProject("storybook-panel-tabs");
  if (options.resource) {
    workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "document", id: "one" } });
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
          "A lone page hides its tab. Closable auxiliary panels keep their Close button visible. alwaysShowTabs can show either kind, and header actions remain available.",
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
    const close = await canvas.findByRole("button", { name: "Close side first" });
    await expect(close).toBeVisible();
    await userEvent.click(close);
    await expect(canvas.queryByText("side.first content")).not.toBeInTheDocument();
    await expect(canvas.getByText("main.first content")).toBeVisible();
  },
};
export const MultipleItems: Story = { args: { workbench: createPanelWorkbench({ multiple: true }) } };
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

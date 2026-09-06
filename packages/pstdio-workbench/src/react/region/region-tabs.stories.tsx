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
    resourceLabel?: string;
    tabLabel?: string;
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
  const slots: WorkbenchPageSlot[] = workbenchPanelRegions.flatMap((region) => [
    ...(region === "main"
      ? []
      : [
          {
            id: `${region}.first`,
            region,
            item: {
              kind: "view" as const,
              view: { kind: "view" as const, id: `${region}.first` },
              presence: options.closable ? ("open" as const) : ("fixed" as const),
            },
          },
        ]),
    ...(options.multiple
      ? [
          {
            id: `${region}.second`,
            region,
            item: {
              kind: "view" as const,
              view: { kind: "view" as const, id: `${region}.second` },
              presence: "open" as const,
            },
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
    main: { kind: "view", view: { kind: "view", id: "main.first" }, cardinality: "one" },
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
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: {
      kind: "view",
      view: { kind: "view", id: "main.first" },
      cardinality: "one",
      ...(options.tabLabel ? { tab: { getSnapshot: () => ({ label: options.tabLabel }) } } : {}),
    },
    slots,
  });
  workbench.pageLocations.switchProject("storybook-panel-tabs");
  if (options.resource) {
    workbench.pageLocations.navigate({
      kind: "page",
      page: resourcePage,
      resource: { type: "document", id: "one", label: options.resourceLabel },
    });
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
          "A lone closable panel keeps its tab and Close button. alwaysShowTabs overrides the single-tab default. Header actions remain available without tabs.",
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
    await expect(await canvas.findByRole("button", { name: "Close main first" })).toBeVisible();
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
    await userEvent.click(await canvas.findByRole("button", { name: "Close side first" }));
    await expect(canvas.queryByText("side.first content")).toBeNull();
    await expect(await canvas.findByRole("button", { name: "Close secondary first" })).toBeVisible();
  },
};
export const HiddenSingleTabs: Story = {
  args: { workbench: createPanelWorkbench({ closable: true, alwaysShowTabs: false }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole("tab")).toHaveLength(0);
  },
};
export const ResourceTabLabel: Story = {
  args: { workbench: createPanelWorkbench({ resource: true, resourceLabel: "Design notes", alwaysShowTabs: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("tab", { name: "Design notes" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close Design notes" }));
    await expect(canvas.queryByRole("tab", { name: "Design notes" })).toBeNull();
  },
};
export const ExplicitTabLabel: Story = {
  args: {
    workbench: createPanelWorkbench({
      resource: true,
      resourceLabel: "Design notes",
      tabLabel: "Unsaved notes",
      alwaysShowTabs: true,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("tab", { name: "Unsaved notes" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close Unsaved notes" }));
    await expect(canvas.queryByRole("tab", { name: "Unsaved notes" })).toBeNull();
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
      if (region === "main") {
        await expect(canvas.queryByRole("tab", { name: `${region} first` })).not.toBeInTheDocument();
      } else {
        await expect(canvas.getByRole("button", { name: `Close ${region} first` })).toBeVisible();
      }
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

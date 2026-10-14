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
    showHeader?: boolean;
    multiple?: boolean;
    actions?: boolean;
    closable?: boolean;
    resource?: boolean;
    menu?: boolean;
    menusOnly?: boolean;
    cardinality?: "one" | "many";
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
      workbenchPanelRegions.map((region) => [region, { showHeader: options.showHeader }]),
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
  if (options.menu) {
    workbench.viewMenus.registerViewMenu({
      id: "inspector",
      ownerViewId: "main.first",
      viewId: "main.second",
      side: "right",
    });
  }
  const slots: WorkbenchPageSlot[] = workbenchPanelRegions.flatMap((region) => [
    ...(region === "main" || options.menusOnly
      ? []
      : [
          {
            id: `${region}.first`,
            region,
            item: {
              kind: "view" as const,
              view: { kind: "view" as const, id: `${region}.first` },
              presence: "open" as const,
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
    regionSettings: {
      main: { showHeader: options.showHeader },
      aside: { showHeader: options.showHeader },
      bottom: { showHeader: options.showHeader },
    },
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
      cardinality: options.cardinality ?? "one",
      ...(options.tabLabel ? { tab: { getSnapshot: () => ({ label: options.tabLabel }) } } : {}),
    },
    slots,
    regionSettings: {
      main: { showHeader: options.showHeader },
      aside: { showHeader: options.showHeader },
      bottom: { showHeader: options.showHeader },
    },
  });
  workbench.pageLocations.switchProject("storybook-panel-tabs");
  if (options.menusOnly) {
    for (const region of ["secondary", "side"] as const) {
      const id = `${region}.menu`;
      workbench.layout.registerPanelMenu({
        id,
        title: `${region} menu`,
        region: `${region}-right-menu`,
        rendererId: `${region}.second`,
        regionCollapsible: false,
      });
      workbench.layout.openWidget(id);
    }
  }
  if (options.resource) {
    workbench.pageLocations.navigate({
      kind: "page",
      page: resourcePage,
      resource: { type: "document", id: "one", label: options.resourceLabel },
    });
  }
  return workbench;
};
const createUnavailableMenuWorkbench = () => {
  const workbench = createPanelWorkbench();
  workbench.modes.registerMode({ id: "main-only", label: "Main only", panels: ["main"], activate: () => undefined });
  workbench.layout.registerPlaceholder({
    id: "unavailable-menu",
    title: "Unavailable menu",
    region: "side-right-menu",
    rendererId: "side.second",
    regionCollapsible: false,
  });
  workbench.modes.setActiveMode("main-only");
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
          "Every declared tool can close. A panel keeps its single tab visible unless showHeader is false. Closed tools can reopen from the panel empty state or its + catalog.",
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
    await expect(canvas.queryAllByRole("tab")).toHaveLength(workbenchPanelRegions.length);
  },
};
export const MenuOnlyPanels: Story = {
  args: { workbench: createPanelWorkbench({ menusOnly: true, showHeader: false }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const region of ["secondary", "side"] as const) {
      await expect(await canvas.findByText(`${region}.second content`)).toBeVisible();
    }
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
  },
};
export const UnavailableMenuPanel: Story = {
  args: { workbench: createUnavailableMenuWorkbench() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: /(?:Show|Hide) Sidebar/ })).toBeNull();
    await expect(canvas.queryByText("side.second content")).not.toBeVisible();
  },
};
export const AlwaysShowTabs: Story = {
  args: { workbench: createPanelWorkbench({ showHeader: true }) },
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
    await expect(canvas.queryAllByRole("tab")).toHaveLength(workbenchPanelRegions.length);
  },
};
export const SingleResourceWithMenu: Story = {
  args: { workbench: createPanelWorkbench({ resource: true, menu: true }) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("main.first content")).toBeVisible();
    await expect(await canvas.findByText("main.second content")).toBeVisible();
    const header = canvasElement.querySelector('[data-workbench-panel-header="main"]');
    await expect(header).toBeVisible();
    const menu = args.workbench.layout.getLayout().regions["main-right-menu"].widgets[0]!;
    args.workbench.panelMenuState.setOpen(`panel-menu:${menu.widgetId}`, false);
    await expect(await canvas.findByRole("button", { name: "Panel tabs panels" })).toBeVisible();
    args.workbench.panelMenuState.setOpen(`panel-menu:${menu.widgetId}`, true);
    await expect(header).toBeVisible();
  },
};
export const CloseResourcePage: Story = {
  args: { workbench: createPanelWorkbench({ resource: true, cardinality: "many" }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Close main first" }));
    await expect(canvas.getByRole("button", { name: "Close main first" })).toBeVisible();
    await expect(
      canvas.getAllByText("main.first content").filter((element) => element.getClientRects().length > 0),
    ).toHaveLength(1);
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
    await expect(canvas.queryByText("side.first content")).not.toBeVisible();
    await expect(await canvas.findByRole("button", { name: "Close secondary first" })).toBeVisible();
  },
};
export const HiddenSingleTabs: Story = {
  args: { workbench: createPanelWorkbench({ closable: true, showHeader: false }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryAllByRole("tab")).toHaveLength(0);
  },
};
export const ResourceTabLabel: Story = {
  args: { workbench: createPanelWorkbench({ resource: true, resourceLabel: "Design notes", cardinality: "many" }) },
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
      cardinality: "many",
      resourceLabel: "Design notes",
      tabLabel: "Unsaved notes",
      showHeader: true,
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
  args: { workbench: createPanelWorkbench({ closable: true, showHeader: true }) },
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
        await expect(canvas.getByRole("tab", { name: `${region} first` })).toBeVisible();
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
    await expect(canvas.queryAllByRole("tab")).toHaveLength(workbenchPanelRegions.length);
  },
};

import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench, type WorkbenchPanelRegion } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createEmptyWorkbench = (pageEntries = false) => {
  const workbench = createWorkbench({ initialSidePanelMode: "attached" });
  workbench.modes.registerMode({
    id: "tools",
    activate() {},
  });
  for (const [id, title] of [
    ["terminal", "Terminal"],
    ["session", "Session"],
    ["inspector", "Inspector"],
  ]) {
    workbench.views.registerView({
      id,
      title,
      icon: id === "terminal" ? "Terminal" : undefined,
      body: { kind: "react", render: () => <Text p="md">{title} content</Text> },
    });
    workbench.modePlacements.registerPlacement({
      id,
      ref: { kind: "placement", extensionId: "example", id },
      modeId: "tools",
      region: "side",
      ...(id === "inspector" ? { movableTo: ["side"] } : {}),
      item: { kind: "view", view: { kind: "view", id }, presence: "closed" },
    });
  }
  const page = { kind: "page", extensionId: "example", id: "tools" } as const;
  if (pageEntries)
    for (const [id, title] of [
      ["changes", "Changes"],
      ["new-page", "New page"],
    ]) {
      workbench.views.registerView({
        id,
        title,
        icon: "FilePlus",
        body: { kind: "react", render: () => <Text p="md">{title} content</Text> },
      });
    }
  workbench.pages.registerPage({
    id: "tools",
    ref: page,
    title: "Tools",
    path: "tools",
    modeId: "tools",
    main: { kind: "panels" },
    slots: pageEntries
      ? ["changes", "new-page"].map((id) => ({
          id,
          region: "main" as const,
          item: { kind: "view" as const, view: { kind: "view" as const, id }, presence: "closed" as const },
        }))
      : [],
  });
  workbench.pageLocations.setProject("storybook-empty-panels");
  workbench.pageLocations.navigate({ kind: "page", page });
  workbench.shell.setSidePanelPresentation("attached");
  workbench.shell.setRegionOpen("secondary", true);
  return workbench;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Empty panel",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AvailableTabs: Story = { args: { workbench: createEmptyWorkbench() } };
export const NarrowPanel: Story = { args: { workbench: createEmptyWorkbench() } };
export const PageEntries: Story = { args: { workbench: createEmptyWorkbench(true) } };

export const TopAlignedCards: Story = {
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench(true);
      workbench.shell.setRegionOpen("side", false);
      workbench.shell.setRegionOpen("secondary", false);
      return workbench;
    })(),
  },
};

export const ShortcutPreview: Story = {
  args: { workbench: createEmptyWorkbench() },
  play: async ({ canvasElement }) => {
    await userEvent.keyboard("{Alt>}");
    await waitFor(() => expect(canvasElement.querySelector('[aria-label="Available tabs"] kbd')).not.toBeNull());
  },
};

const openCard = async (canvasElement: HTMLElement, region: WorkbenchPanelRegion) => {
  const panel = within(canvasElement.querySelector(`[data-workbench-panel="${region}"]`) as HTMLElement);
  const cards = within(await panel.findByRole("group", { name: "Available tabs" }));
  await userEvent.click(cards.getByRole("button", { name: "Terminal" }));
  await expect(await panel.findByText("Terminal content")).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Terminal" })).toBeVisible();
};

export const OpenInMain: Story = {
  args: { workbench: createEmptyWorkbench() },
  play: async ({ canvasElement }) => openCard(canvasElement, "main"),
};
export const OpenInSide: Story = {
  args: { workbench: createEmptyWorkbench() },
  play: async ({ canvasElement }) => openCard(canvasElement, "side"),
};
export const OpenInBottom: Story = {
  args: { workbench: createEmptyWorkbench() },
  play: async ({ canvasElement }) => openCard(canvasElement, "secondary"),
};

export const CustomPlaceholders: Story = {
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench();
      workbench.views.registerView({
        id: "custom-placeholder",
        title: "Custom placeholder",
        body: { kind: "react", render: () => <Text p="md">Custom panel content</Text> },
      });
      for (const region of ["main", "side"] as const)
        workbench.placeholders.registerPlaceholder({ id: `custom-${region}`, viewId: "custom-placeholder", region });
      return workbench;
    })(),
  },
};

export const SelectingMode: Story = {
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench();
      workbench.pageLocations.clearProject();
      workbench.modes.setActiveMode(undefined);
      workbench.shellPlacements.registerPlacement({
        id: "loading-terminal",
        region: "main",
        item: { kind: "view", view: { kind: "view", id: "terminal" }, presence: "closed" },
      });
      return workbench;
    })(),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("group", { name: "Available tabs" })).toBeNull();
  },
};

export const TabsDisabled: Story = {
  tags: ["panel-placeholder-policy"],
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench();
      workbench.modes.registerMode({
        id: "selection",
        panels: [],
        regionSettings: { main: { acceptsTabs: false, showHeader: false } },
        activate() {},
      });
      workbench.pageLocations.clearProject();
      workbench.modes.setActiveMode("selection");
      return workbench;
    })(),
  },
  play: async ({ canvasElement }) => {
    const main = within(canvasElement.querySelector('[data-workbench-panel="main"]') as HTMLElement);
    await expect(main.queryByRole("group", { name: "Available tabs" })).toBeNull();
    await expect(main.queryByText("No tabs available")).toBeNull();
  },
};

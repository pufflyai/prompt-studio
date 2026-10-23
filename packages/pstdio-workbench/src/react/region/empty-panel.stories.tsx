import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench, type WorkbenchPanelRegion } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createEmptyWorkbench = (hiddenHeader = false) => {
  const workbench = createWorkbench({ initialSidePanelMode: "attached" });
  workbench.modes.registerMode({
    id: "tools",
    activate() {},
    regionSettings: { main: { showHeader: !hiddenHeader } },
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
  workbench.pages.registerPage({
    id: "tools",
    ref: page,
    title: "Tools",
    path: "tools",
    modeId: "tools",
    main: { kind: "panels" },
    slots: [],
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
export const HiddenHeader: Story = { args: { workbench: createEmptyWorkbench(true) } };

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

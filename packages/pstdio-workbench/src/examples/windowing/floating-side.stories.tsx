import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture, type WindowingFixture } from "./fixture";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
let fixture: WindowingFixture;
const createFixture = () => {
  fixture = createWindowingFixture("windowing", { floatingSessionDefault: true, pagePanels: true });
  fixture.workbench.shell.setRegionOpen("side", false);
  return fixture;
};

export const AttachedAndFloating: Story = {
  args: { createFixture },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Open Side Panel" }));
    const bubble = canvas.getByRole("button", { name: "Close Side Panel" });
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveAttribute("aria-pressed", "true");
    const panel = canvas.getByTestId("workbench-side-panel-floating");
    await waitFor(() => expect(panel).toBeVisible());
    await expect(within(panel).queryByRole("button", { name: "Close Side Panel" })).toBeNull();
    await expect(await within(panel).findByRole("tab", { name: /New session/ })).toBeVisible();
    const tabs = fixture.workbench.layout.getLayout().regions.side.widgets;
    await userEvent.click(canvas.getByRole("button", { name: "Show Sidebar" }));
    await waitFor(() => expect(canvas.getByTestId("workbench-side-panel-attached")).toBeVisible());
    await expect(fixture.workbench.layout.getLayout().regions.side.widgets).toEqual(tabs);
    await userEvent.click(canvas.getByRole("button", { name: "Hide Sidebar" }));
    await userEvent.click(canvas.getByRole("button", { name: "Open Side Panel" }));
    await userEvent.click(canvas.getByRole("button", { name: "Close Side Panel" }));
    await waitFor(() => expect(panel).not.toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Open Side Panel" }));
    await expect(fixture.workbench.layout.getLayout().regions.side.widgets).toEqual(tabs);
  },
};

export const BubbleKeyboard: Story = {
  args: { createFixture },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bubble = await canvas.findByRole("button", { name: "Open Side Panel" });
    bubble.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 0.5, y: 1 }));
    await userEvent.keyboard("{ArrowUp}");
    await waitFor(() => expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 0.5, y: 0 }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 1, y: 1 }));
    await userEvent.keyboard("{ArrowUp}{Home}");
    await waitFor(() => expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 1, y: 1 }));
    await expect(fixture.workbench.sidePanel.getMode()).toBe("closed");
    await expect(fixture.workbench.layout.listPanelInstances("side")).toHaveLength(0);
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 0.5, y: 1 });
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await waitFor(() => expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 0.5, y: 1 }));
  },
};

export const BubblePointer: Story = {
  args: { createFixture },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("button", { name: "Open Side Panel" })).toBeVisible();
    await expect(fixture.workbench.sidePanel.getBubblePosition()).toEqual({ x: 1, y: 1 });
  },
};

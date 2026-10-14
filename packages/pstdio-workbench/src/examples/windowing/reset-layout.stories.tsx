import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { moveStoryTab } from "./tab-moves";
import { visibleWindowingLabel } from "./visible-label";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
const createFixture = () => createWindowingFixture("windowing", { pagePanels: true, resetControls: true });
const panel = (root: HTMLElement, region: string) =>
  within(root.querySelector<HTMLElement>(`[data-workbench-panel="${region}"]`)!);
const resetPage = async (root: HTMLElement) => {
  await userEvent.click(within(root).getByRole("button", { name: "Workspace panels" }));
  await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Reset layout" }));
};

export const ResetClosedFiles: Story = {
  args: { createFixture },
  play: async ({ canvasElement }) => {
    await userEvent.click(await panel(canvasElement, "main").findByRole("button", { name: "Close Files" }));
    await resetPage(canvasElement);
    await expect(await panel(canvasElement, "main").findByRole("tab", { name: "Files" })).toBeVisible();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Workspace 2" }));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Workspace 1" }));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Reload fixture" }));
    await expect(await panel(canvasElement, "main").findByRole("tab", { name: "Files" })).toBeVisible();
  },
};

export const ResetMovedFiles: Story = {
  args: { createFixture },
  play: async ({ canvasElement }) => {
    await moveStoryTab(await panel(canvasElement, "main").findByRole("tab", { name: "Files" }), "Side");
    const draft = visibleWindowingLabel(canvasElement, "Files draft")!;
    await userEvent.type(draft, "Keep this draft");
    await resetPage(canvasElement);
    await expect(panel(canvasElement, "side").getByRole("tab", { name: "Files" })).toBeVisible();
    await expect(panel(canvasElement, "main").queryByRole("tab", { name: "Files" })).toBeNull();
    await expect(draft).toHaveValue("Keep this draft");
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Reload fixture" }));
    await resetPage(canvasElement);
    await expect(await panel(canvasElement, "side").findByRole("tab", { name: "Files" })).toBeVisible();
  },
};

export const ResetForeignSession: Story = {
  args: { createFixture },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Session 2" }));
    await moveStoryTab(await panel(canvasElement, "side").findByRole("tab", { name: /^Session 2/ }), "Main");
    await resetPage(canvasElement);
    await expect(panel(canvasElement, "main").getByRole("tab", { name: /^Session 2/ })).toBeVisible();
    await expect(visibleWindowingLabel(canvasElement, "Session context")).toHaveTextContent("Workspace 2");
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await expect(await panel(canvasElement, "main").findByRole("tab", { name: /^Session 2/ })).toBeVisible();
  },
};

export const ResetPageGeometry: Story = {
  args: { createFixture },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Move and resize page side" }));
    await expect(canvas.getByLabelText("Page side geometry")).toHaveTextContent("left · 350");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace panels" }));
    await userEvent.click(await within(document.body).findByRole("menuitemcheckbox", { name: "Inspector" }));
    await resetPage(canvasElement);
    await expect(canvas.getByLabelText("Page side geometry")).toHaveTextContent("right · default");
    await waitFor(() => expect(visibleWindowingLabel(canvasElement, "Inspector binding")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await expect(canvas.getByLabelText("Page side geometry")).toHaveTextContent("right · default");
  },
};

export const ResetPlayer: Story = {
  args: {
    createFixture: () => {
      const fixture = createWindowingFixture("boombox", { resetControls: true });
      fixture.workbench.shell.setHeaderVisible("secondary", true);
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await panel(canvasElement, "secondary").findByRole("button", { name: "Close Player" }));
    await userEvent.click(canvas.getByRole("button", { name: "Reset mode layout" }));
    await expect(await panel(canvasElement, "secondary").findByRole("button", { name: "Pause" })).toBeVisible();
  },
};

export const ResetClosedTerminal: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true, terminalPreset: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await moveStoryTab(await panel(canvasElement, "bottom").findByRole("tab", { name: "Terminal" }), "Side");
    await userEvent.click(panel(canvasElement, "side").getByRole("button", { name: "Close Terminal" }));
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await resetPage(canvasElement);
    await expect(await panel(canvasElement, "bottom").findByRole("tab", { name: "Terminal" })).toBeVisible();
    await expect(visibleWindowingLabel(canvasElement, "Terminal resource")).toHaveTextContent("terminal-1");
    await expect(visibleWindowingLabel(canvasElement, "Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 0");
    await resetPage(canvasElement);
    await expect(panel(canvasElement, "bottom").getAllByRole("tab", { name: "Terminal" })).toHaveLength(1);
  },
};

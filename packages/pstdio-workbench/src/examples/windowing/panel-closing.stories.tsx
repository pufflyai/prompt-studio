import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const dragClosed = async (separator: HTMLElement, dimension: "width" | "height") => {
  const user = userEvent.setup();
  const rect = separator.getBoundingClientRect();
  await user.pointer([
    { target: separator, keys: "[MouseLeft>]", coords: { clientX: rect.x, clientY: rect.y } },
    { target: separator, coords: { clientX: rect.x + 600, clientY: rect.y + 600 } },
  ]);
  const root = separator.parentElement!;
  await expect(root).toHaveAttribute("data-closing", "true");
  const panelId = separator.getAttribute("aria-controls")!.split(" ")[0]!;
  const panel = separator.ownerDocument.getElementById(panelId)!;
  await expect(panel).toBeVisible();
  await expect(panel.getBoundingClientRect()[dimension]).toBeGreaterThan(0);
  await user.pointer({ target: separator, keys: "[/MouseLeft]" });
  await waitFor(() => expect(panel).not.toBeVisible());
};

export const DragClosePageBottom: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole("separator", { name: "Resize page bottom" });
    separator.focus();
    await userEvent.keyboard("{ArrowUp}");
    const bottom = canvasElement.querySelector<HTMLElement>('[data-workbench-panel="bottom"]')!;
    await waitFor(() => expect(bottom.parentElement!.parentElement!.getAnimations()).toHaveLength(0));
    const previousSize = bottom.getBoundingClientRect().height;
    await dragClosed(separator, "height");
    await userEvent.click(canvas.getByRole("button", { name: "Page panels" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Show Page bottom" }));
    await waitFor(() => expect(bottom.getBoundingClientRect().height).toBe(previousSize));
    await expect(bottom).toBeVisible();
  },
};

export const DragCloseSide: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Session 1" }));
    const separator = canvas.getByRole("separator", { name: "Resize Side Panel" });
    separator.focus();
    await userEvent.keyboard("{ArrowLeft}");
    const side = canvasElement.querySelector<HTMLElement>('[data-workbench-panel="side"]')!;
    await waitFor(() => expect(separator.parentElement!.getAnimations()).toHaveLength(0));
    const previousSize = side.getBoundingClientRect().width;
    await dragClosed(separator, "width");
    await userEvent.click(canvas.getByRole("button", { name: "Show Side Panel" }));
    await waitFor(() => expect(side.getBoundingClientRect().width).toBe(previousSize));
    await expect(side).toBeVisible();
  },
};

export const DragClosePageSide: Story = {
  args: {
    createFixture: () => {
      const fixture = createWindowingFixture("windowing", { pagePanels: true });
      fixture.workbench.shell.setRegionOpen("aside", true);
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole("separator", { name: "Resize page side" });
    const aside = canvasElement.querySelector<HTMLElement>('[data-workbench-panel="aside"]')!;
    await waitFor(() => expect(separator.parentElement!.getAnimations()).toHaveLength(0));
    const previousSize = aside.getBoundingClientRect().width;
    await dragClosed(separator, "width");
    await userEvent.click(canvas.getByRole("button", { name: "Page panels" }));
    await userEvent.click(await within(document.body).findByRole("menuitem", { name: "Show Side panel" }));
    await waitFor(() => expect(aside.getBoundingClientRect().width).toBe(previousSize));
  },
};

export const DragCloseSecondary: Story = {
  args: { createFixture: () => createWindowingFixture() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole("separator", { name: "Resize Secondary Panel" });
    const secondary = canvasElement.querySelector<HTMLElement>('[data-workbench-panel="secondary"]')!;
    const previousSize = secondary.getBoundingClientRect().height;
    await dragClosed(separator, "height");
    await userEvent.click(canvas.getByRole("button", { name: "Show Secondary Panel" }));
    await waitFor(() => expect(secondary.getBoundingClientRect().height).toBe(previousSize));
  },
};

export const DragFixedPanel: Story = {
  args: {
    createFixture: () =>
      createWindowingFixture("windowing", {
        regionSettings: { side: { canClose: false, canOpen: false, resizable: true, floatable: false } },
      }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole("separator", { name: "Resize Side Panel" });
    const rect = separator.getBoundingClientRect();
    await userEvent.pointer([
      { target: separator, keys: "[MouseLeft>]", coords: { clientX: rect.x, clientY: rect.y } },
      { target: separator, coords: { clientX: rect.x + 600, clientY: rect.y } },
      { target: separator, keys: "[/MouseLeft]" },
    ]);
    await expect(separator.parentElement!).toHaveAttribute("data-closing", "false");
    const side = canvasElement.querySelector<HTMLElement>('[data-workbench-panel="side"]')!;
    await expect(side).toBeVisible();
    await expect(side.getBoundingClientRect().width).toBeGreaterThanOrEqual(320);
  },
};

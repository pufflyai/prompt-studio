import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { windowingExtensionId, windowingPages } from "./resources";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
const panel = (root: HTMLElement, region: string) =>
  root.querySelector<HTMLElement>(`[data-workbench-panel="${region}"]`)!;
const moveSession = async (root: HTMLElement, name: string, destination: string) => {
  const tab = within(panel(root, "side")).getByRole("tab", { name: new RegExp(`^${name}(?: ·|$)`) });
  tab.focus();
  await userEvent.keyboard("{Shift>}{F10}{/Shift}");
  await userEvent.click(await within(document.body).findByRole("menuitem", { name: `Move to ${destination}` }));
};

export const PageSideOwnership: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Session 1" }));
    await moveSession(canvasElement, "Session 1", "Page side");
    await expect(within(panel(canvasElement, "aside")).getByRole("tab", { name: /^Session 1/ })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Session 2" }));
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await waitFor(() => expect(panel(canvasElement, "aside")).not.toBeVisible());
    await expect(within(panel(canvasElement, "side")).getByRole("tab", { name: /^Session 2/ })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 1" }));
    await expect(within(panel(canvasElement, "aside")).getByRole("tab", { name: /^Session 1/ })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await waitFor(() =>
      expect(within(panel(canvasElement, "aside")).getByRole("tab", { name: /^Session 1/ })).toBeVisible(),
    );
  },
};

export const UndeclaredPagePanels: Story = {
  args: {
    createFixture: () => {
      const fixture = createWindowingFixture();
      fixture.workbench.pageLocations.navigate({ kind: "page", page: windowingPages.sessions });
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sessions panels" }));
    await userEvent.click(await within(document.body).findByRole("menuitemcheckbox", { name: "Side panel" }));
    await expect(panel(canvasElement, "aside")).toBeVisible();
    await expect(within(panel(canvasElement, "aside")).getByText("Drop a tab here")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Session 1" }));
    await moveSession(canvasElement, "Session 1", "Page side");
    await userEvent.click(canvas.getByRole("button", { name: "Session 2" }));
    await moveSession(canvasElement, "Session 2", "Page bottom");
    await expect(within(panel(canvasElement, "aside")).getByRole("tab", { name: /^Session 1/ })).toBeVisible();
    await expect(within(panel(canvasElement, "bottom")).getByRole("tab", { name: /^Session 2/ })).toBeVisible();
  },
};

export const TicketPanelMenu: Story = {
  args: {
    createFixture: () => {
      const fixture = createWindowingFixture("windowing", { pagePanels: true });
      fixture.workbench.pageLocations.navigate({
        kind: "page",
        page: { kind: "page", extensionId: windowingExtensionId, id: "ticket" },
      });
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    const menu = canvasElement.querySelector<HTMLElement>('[data-workbench-panel-menu="main-right"]')!;
    const tabs = canvasElement.querySelector<HTMLElement>('[data-workbench-panel-header="main"]')!;
    await waitFor(() => expect(within(menu).getByText("Inspector")).toBeVisible());
    await expect(Math.abs(menu.getBoundingClientRect().top - tabs.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
    await expect(menu.querySelector('[role="tablist"]')).toBeNull();
    await expect(menu.querySelector("[data-workbench-tab-drop]")).toBeNull();
  },
};

const geometryFixture = (leftTop = false) => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    pageRegionSettings: {
      aside: { edge: leftTop ? "left" : "right", size: { defaultPx: 280, minPx: 160 } },
      bottom: { edge: leftTop ? "top" : "bottom", size: { defaultPx: 160 } },
    },
  });
  fixture.workbench.shell.setRegionOpen("aside", true);
  fixture.workbench.shell.setRegionOpen("side", false);
  return fixture;
};
export const PagePanelGeometry: Story = {
  args: { createFixture: () => geometryFixture() },
  play: async ({ canvasElement }) => {
    const aside = panel(canvasElement, "aside").getBoundingClientRect();
    const bottom = panel(canvasElement, "bottom").getBoundingClientRect();
    const modeBottom = panel(canvasElement, "secondary").getBoundingClientRect();
    const tabs = canvasElement.querySelector('[data-workbench-panel-header="main"]')!.getBoundingClientRect();
    await expect(bottom.width).toBeLessThan(modeBottom.width);
    await expect(Math.abs(aside.top - tabs.top)).toBeLessThanOrEqual(1);
    await expect(Math.abs(aside.bottom - bottom.bottom)).toBeLessThanOrEqual(1);
    await expect(bottom.right).toBeLessThanOrEqual(aside.left);
    const rightMenu = canvasElement.querySelector('[data-workbench-panel-menu="main-right"]')!.getBoundingClientRect();
    await expect(Math.abs(rightMenu.right - bottom.right)).toBeLessThanOrEqual(1);
  },
};
export const PagePanelsLeftTop: Story = {
  args: { createFixture: () => geometryFixture(true) },
  play: async ({ canvasElement }) => {
    const aside = panel(canvasElement, "aside").getBoundingClientRect();
    const bottom = panel(canvasElement, "bottom").getBoundingClientRect();
    const tabs = canvasElement.querySelector('[data-workbench-panel-header="main"]')!.getBoundingClientRect();
    await expect(aside.right).toBeLessThanOrEqual(bottom.left);
    await expect(bottom.bottom).toBeLessThanOrEqual(tabs.top);
    await expect(Math.abs(aside.top - bottom.top)).toBeLessThanOrEqual(1);
  },
};

export const NarrowPageSide: Story = {
  args: {
    width: "2xl",
    createFixture: () => {
      const fixture = createWindowingFixture();
      fixture.workbench.pageLocations.navigate({ kind: "page", page: windowingPages.sessions });
      fixture.workbench.shell.setRegionOpen("side", false);
      fixture.workbench.shell.setRegionOpen("secondary", false);
      fixture.workbench.shell.setRegionOpen("aside", true);
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const aside = panel(canvasElement, "aside").getBoundingClientRect();
      const editor = canvasElement.querySelector("[data-workbench-editor]")!.getBoundingClientRect();
      expect(aside.width).toBeLessThan(280);
      expect(editor.width).toBeGreaterThanOrEqual(480);
    });
  },
};

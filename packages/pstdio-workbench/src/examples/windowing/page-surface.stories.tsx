import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture } from "./fixture";
import { visibleWindowingLabel } from "./visible-label";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PageSurface: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText("Inspector binding")).toHaveTextContent("Workspace 1");
    const main = canvasElement.querySelector('[data-workbench-panel="main"]')!;
    const bottom = main.querySelector('[data-workbench-panel="bottom"]')!;
    await expect(bottom).toBeVisible();
    await expect(canvasElement.querySelector('[data-workbench-panel="secondary"]')).toBeVisible();
    await expect(main.querySelector('[data-workbench-region="nav"]')).toBeVisible();
    const tabs = main.querySelector('[data-workbench-panel-header="main"]')!;
    const menus = Array.from(
      main.querySelectorAll('[data-workbench-panel-menu="main-left"], [data-workbench-panel-menu="main-right"]'),
    );
    for (const menu of menus) {
      await expect(menu.querySelector('[role="tablist"]')).toBeNull();
      await expect(menu.querySelector("[data-workbench-tab-drop]")).toBeNull();
      await expect(Math.abs(menu.getBoundingClientRect().top - tabs.getBoundingClientRect().top)).toBeLessThanOrEqual(
        1,
      );
    }
    await userEvent.click(canvas.getByRole("button", { name: "Workspace panels" }));
    const popup = within(document.body);
    await waitFor(() =>
      expect(popup.getByRole("menu", { name: "Workspace panels" }).getBoundingClientRect().top).toBeGreaterThanOrEqual(
        canvas.getByRole("button", { name: "Workspace panels" }).getBoundingClientRect().bottom,
      ),
    );
    await userEvent.click(await popup.findByRole("menuitemcheckbox", { name: "Inspector" }));
    await waitFor(() => expect(visibleWindowingLabel(canvasElement, "Inspector binding")).not.toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Workspace panels" }));
    await userEvent.click(await popup.findByRole("menuitemcheckbox", { name: "Inspector" }));
    await waitFor(() => expect(visibleWindowingLabel(canvasElement, "Inspector binding")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await expect(visibleWindowingLabel(canvasElement, "Inspector binding")).toHaveTextContent("Workspace 2");
    await expect(visibleWindowingLabel(canvasElement, "Terminal binding")).toHaveTextContent("workspace-2");
    await expect(visibleWindowingLabel(canvasElement, "Mode tools binding")).toHaveTextContent("Project");
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await expect(visibleWindowingLabel(canvasElement, "Inspector binding")).toHaveTextContent("Workspace 2");
    const terminalPanel = canvasElement.querySelector('[data-workbench-panel="bottom"]')!;
    await userEvent.click(within(terminalPanel as HTMLElement).getByRole("button", { name: "Close Terminal" }));
    await userEvent.click(canvas.getByRole("button", { name: "Workspace panels" }));
    await userEvent.click(await popup.findByRole("menuitemcheckbox", { name: "Bottom panel" }));
    await waitFor(() => expect(terminalPanel).toBeVisible());
    await userEvent.click(within(terminalPanel as HTMLElement).getByRole("button", { name: "Add panel" }));
    await userEvent.click(await popup.findByRole("menuitem", { name: /^Terminal$/ }));
    await waitFor(() =>
      expect(visibleWindowingLabel(canvasElement, "Terminal binding")).toHaveTextContent("workspace-2"),
    );
    await expect(visibleWindowingLabel(canvasElement, "Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 0");
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

export const PageSurfaceWebview: Story = {
  args: { createFixture: () => createWindowingFixture("windowing", { pagePanels: true, mainView: "webview" }) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('iframe[title="Windowing webview"]')).toBeVisible();
    await expect(within(canvasElement).getByLabelText("Inspector binding")).toHaveTextContent("Workspace 1");
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createPanelControlsFixture } from "./panel-controls-fixture";
import { windowingExtensionId, windowingPages } from "./resources";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const checkOrder = async (root: HTMLElement, expected: string[]) => {
  const status = root.querySelector<HTMLElement>('[data-workbench-region="status"]')!;
  await expect(status).toBeVisible();
  await expect(
    Array.from(status.querySelectorAll("[data-workbench-panel-toggles] button")).map((button) =>
      button.getAttribute("aria-label"),
    ),
  ).toEqual(expected);
  await expect(root.querySelector('[data-workbench-region="nav"] [data-workbench-panel-toggles]')).toBeNull();
};

export const PanelTogglesDefault: Story = {
  args: { createFixture: () => createPanelControlsFixture() },
  play: async ({ canvasElement }) => {
    await checkOrder(canvasElement, ["Show Navigation", "Hide Bottom panel", "Hide Sidebar"]);
    const button = within(canvasElement).getByRole("button", { name: "Show Navigation" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect(within(canvasElement).getByRole("button", { name: "Hide Navigation" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvasElement.querySelector('[data-workbench-region="sidenav"]')).toBeVisible();
    const toggle = within(canvasElement).getByRole("button", { name: "Hide Navigation" });
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    await expect(toggle).toHaveFocus();
    await waitFor(() => expect(within(document.body).getByRole("tooltip", { name: "Hide Navigation" })).toBeVisible());
  },
};
export const PanelTogglesSideLeft: Story = {
  args: { createFixture: () => createPanelControlsFixture({ side: "left" }) },
  play: async ({ canvasElement }) =>
    checkOrder(canvasElement, ["Show Navigation", "Hide Sidebar", "Hide Bottom panel"]),
};
export const PanelTogglesNavigationRight: Story = {
  args: { createFixture: () => createPanelControlsFixture({ sidenav: "right" }) },
  play: async ({ canvasElement }) =>
    checkOrder(canvasElement, ["Hide Bottom panel", "Hide Sidebar", "Show Navigation"]),
};
export const PanelTogglesModeStatus: Story = {
  args: { createFixture: () => createPanelControlsFixture({}, true) },
  play: async ({ canvasElement }) => {
    await checkOrder(canvasElement, ["Show Navigation", "Hide Bottom panel", "Hide Sidebar"]);
    await expect(within(canvasElement).getByText("Mode status")).toBeVisible();
  },
};
export const PanelTogglesKiln: Story = {
  args: { mode: "kiln" },
  play: async ({ canvasElement }) => checkOrder(canvasElement, ["Hide Navigation", "Hide Sidebar"]),
};
export const PanelTogglesHiddenStatus: Story = {
  args: { createFixture: () => createPanelControlsFixture({}, "hidden") },
  play: async ({ canvasElement }) => {
    await checkOrder(canvasElement, ["Show Navigation", "Hide Bottom panel", "Hide Sidebar"]);
    await expect(within(canvasElement).queryByText("Mode status")).not.toBeVisible();
  },
};
export const PanelTogglesBoombox: Story = {
  args: { mode: "boombox" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-workbench-panel-toggles]")).toBeNull();
    await expect(canvasElement.querySelector('[data-workbench-region="status"]')).not.toBeVisible();
  },
};

const checkPageHeader = async (root: HTMLElement, label: string, menus: string[]) => {
  const header = root.querySelector<HTMLElement>('[data-workbench-region="nav"]')!;
  const tabRow = root.querySelector<HTMLElement>('[data-workbench-panel-header="main"]')!;
  await expect(within(header).getByRole("button", { name: "Windowing project" })).toBeVisible();
  await expect(within(header).getByRole("navigation", { name: "breadcrumb" })).toBeVisible();
  await expect(within(header).getByRole("button", { name: label })).toBeVisible();
  await expect(within(tabRow).queryByRole("button", { name: label })).toBeNull();
  await userEvent.click(within(header).getByRole("button", { name: label }));
  const popup = await within(document.body).findByRole("menu", { name: label });
  await expect(
    within(popup)
      .getAllByRole("menuitemcheckbox")
      .map((item) => item.textContent),
  ).toEqual(["Bottom panel", "Side panel", ...menus]);
  await waitFor(() => expect(within(popup).getByRole("menuitem", { name: "Reset layout" })).toBeVisible());
  await userEvent.keyboard("{Escape}");
};
export const WorkspacePageHeader: Story = {
  args: { createFixture: () => createPanelControlsFixture() },
  play: async ({ canvasElement }) =>
    checkPageHeader(canvasElement, "Workspace panels", ["Workspace tools", "Inspector"]),
};
export const TicketPageHeader: Story = {
  args: {
    createFixture: () => {
      const fixture = createPanelControlsFixture();
      fixture.workbench.pageLocations.navigate({
        kind: "page",
        page: { kind: "page", extensionId: windowingExtensionId, id: "ticket" },
      });
      return fixture;
    },
  },
  play: async ({ canvasElement }) => checkPageHeader(canvasElement, "Ticket panels", ["Inspector"]),
};
export const PageHeaderWithoutMenus: Story = {
  args: {
    createFixture: () => {
      const fixture = createPanelControlsFixture();
      fixture.workbench.pageLocations.navigate({ kind: "page", page: windowingPages.sessions });
      return fixture;
    },
  },
  play: async ({ canvasElement }) => checkPageHeader(canvasElement, "Sessions panels", []),
};

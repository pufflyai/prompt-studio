import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture, type WindowingFixture } from "./fixture";
import { windowingExtensionId, windowingPages } from "./resources";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
let fixture: WindowingFixture;

const createFixture = (settings: Parameters<typeof createWindowingFixture>[1] = {}) => {
  fixture = createWindowingFixture("windowing", { pagePanels: true, floatingSessionDefault: true, ...settings });
  fixture.workbench.modes.registerMode({ id: "other", label: "Other", activate() {} });
  fixture.workbench.pages.registerPage({
    ...fixture.workbench.pages.getPage("windowing.sessions")!,
    id: "windowing.compact",
    ref: { kind: "page", id: "compact", extensionId: windowingExtensionId },
    path: "windowing/compact",
    title: "Compact",
    expandable: false,
  });
  return fixture;
};
const openSession = async (presentation: "attached" | "floating") => {
  const core = fixture.workbench;
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", id: "sessions", extensionId: windowingExtensionId },
    resource: fixture.resources.sessions[0],
    open: "pin",
  });
  await core.shell.setRegionOpen("side", true, presentation);
};
const header = (canvasElement: HTMLElement) =>
  within(canvasElement.querySelector<HTMLElement>('[data-workbench-region="nav"]')!);
const enter = async (canvasElement: HTMLElement) => {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: "Expand page" }));
  await expect(header(canvasElement).getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
};

export const FullscreenAttached: Story = {
  args: { createFixture: () => createFixture() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openSession("attached");
    await canvas.findByRole("textbox", { name: "Session draft" });
    const saved = fixture.workbench.layout.getLayout();
    const mounts = { ...fixture.probe.store.getState().mounts };
    const sessions = { ...fixture.probe.store.getState().sessions };
    await enter(canvasElement);
    const overlay = canvas.getByTestId("workbench-side-panel-floating");
    await waitFor(() => expect(overlay).toBeVisible());
    await expect(within(overlay).queryByRole("button", { name: "Reattach Side Panel" })).toBeNull();
    await expect(canvas.queryByRole("group", { name: "Panel toggles" })).toBeNull();
    await expect(fixture.workbench.layout.getLayout()).toBe(saved);
    await userEvent.click(within(overlay).getByRole("button", { name: "Hide Sidebar" }));
    await waitFor(() => expect(overlay).not.toBeVisible());
    await expect(header(canvasElement).getByRole("button", { name: "Show Sidebar" })).toHaveFocus();
    await userEvent.click(header(canvasElement).getByRole("button", { name: "Show Sidebar" }));
    await waitFor(() => expect(overlay).toBeVisible());
    await userEvent.click(header(canvasElement).getByRole("button", { name: "Exit fullscreen" }));
    await expect(canvas.getByTestId("workbench-side-panel-attached")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Expand page" })).toHaveFocus();
    await expect(fixture.probe.store.getState().mounts).toEqual(mounts);
    await expect(fixture.probe.store.getState().sessions).toEqual(sessions);
  },
};

export const FullscreenFloating: Story = {
  args: { createFixture: () => createFixture() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openSession("floating");
    await enter(canvasElement);
    await userEvent.click(header(canvasElement).getByRole("button", { name: "Hide Sidebar" }));
    await userEvent.click(header(canvasElement).getByRole("button", { name: "Exit fullscreen" }));
    await expect(fixture.workbench.sidePanel.getMode()).toBe("closed");
    await expect(fixture.workbench.layout.getLayout().regions.side.presentation).toBe("floating");
    await expect(canvas.getByRole("button", { name: "Open Side Panel" })).toBeVisible();
  },
};

export const FullscreenEmptyOpen: Story = {
  args: { createFixture: () => createFixture() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await enter(canvasElement);
    await expect(canvas.getByTestId("workbench-side-panel-floating")).not.toBeVisible();
    await userEvent.click(header(canvasElement).getByRole("button", { name: "Show Sidebar" }));
    const overlay = within(canvas.getByTestId("workbench-side-panel-floating"));
    await userEvent.click(await overlay.findByRole("button", { name: /^Close New session/ }));
    await expect(fixture.workbench.layout.getLayout().regions.side.widgets).toHaveLength(0);
    await userEvent.click(header(canvasElement).getByRole("button", { name: "Exit fullscreen" }));
    await expect(fixture.workbench.shell.getPanelPolicy("side").open).toBe(true);
  },
};

export const FullscreenNonFloatable: Story = {
  args: { createFixture: () => createFixture({ regionSettings: { side: { floatable: false } } }) },
  play: async ({ canvasElement }) => {
    await openSession("attached");
    await enter(canvasElement);
    await expect(header(canvasElement).queryByRole("button", { name: /Sidebar/ })).toBeNull();
    await expect(within(canvasElement).getByTestId("workbench-side-panel-floating")).not.toBeVisible();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Session 1" }));
    await expect(within(canvasElement).getByRole("button", { name: "Expand page" })).toBeVisible();
  },
};

export const FullscreenFixedSide: Story = {
  args: { createFixture: () => createFixture({ regionSettings: { side: { canOpen: false, canClose: false } } }) },
  play: async ({ canvasElement }) => {
    await enter(canvasElement);
    await waitFor(() => expect(within(canvasElement).getByTestId("workbench-side-panel-floating")).toBeVisible());
    await expect(header(canvasElement).queryByRole("button", { name: /Sidebar/ })).toBeNull();
    await expect(within(canvasElement).queryByRole("button", { name: "Reattach Side Panel" })).toBeNull();
  },
};

export const FullscreenNoSide: Story = {
  args: {
    createFixture: () =>
      createFixture({
        registerMode: (core) =>
          core.modes.registerMode({
            id: "windowing",
            label: "Windowing",
            panels: ["main", "secondary"],
            activate() {},
          }),
      }),
  },
  play: async ({ canvasElement }) => {
    await enter(canvasElement);
    await expect(header(canvasElement).queryByRole("button", { name: /Sidebar/ })).toBeNull();
    await expect(within(canvasElement).getByTestId("workbench-side-panel-floating")).not.toBeVisible();
  },
};

export const FullscreenNavigation: Story = {
  args: { createFixture: () => createFixture() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await enter(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await expect(header(canvasElement).getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    await userEvent.click(header(canvasElement).getByRole("button", { name: "Navigate back" }));
    await expect(fixture.workbench.fullscreen.store.getState().active).toBe(true);
    fixture.workbench.pageLocations.navigate({
      kind: "page",
      page: { kind: "page", id: "compact", extensionId: windowingExtensionId },
    });
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Expand page" })).toBeNull());
    await expect(fixture.workbench.fullscreen.store.getState().active).toBe(false);
    fixture.workbench.pageLocations.goBack();
    await enter(canvasElement);
    fixture.workbench.modes.setActiveMode("other");
    await expect(fixture.workbench.fullscreen.store.getState().active).toBe(false);
  },
};

export const FullscreenReload: Story = {
  args: { createFixture: () => createFixture() },
  play: async ({ canvasElement }) => {
    await enter(canvasElement);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Reload fixture" }));
    await expect(await within(canvasElement).findByRole("button", { name: "Expand page" })).toBeVisible();
    await expect(fixture.workbench.fullscreen.store.getState().active).toBe(false);
  },
};

export const FullscreenRearranged: Story = {
  args: {
    createFixture: () => {
      const result = createFixture();
      result.workbench.repositionPanel("side", "left");
      result.workbench.repositionPanel("secondary", "top");
      return result;
    },
  },
  play: async ({ canvasElement }) => {
    await openSession("attached");
    const saved = fixture.workbench.layout.getLayout();
    await enter(canvasElement);
    await userEvent.keyboard("{Escape}");
    await expect(fixture.workbench.fullscreen.store.getState().active).toBe(false);
    await expect(fixture.workbench.layout.getLayout()).toBe(saved);
    await expect(fixture.workbench.getPanelEdge("side")).toBe("left");
    await expect(fixture.workbench.getPanelEdge("secondary")).toBe("top");
  },
};

export const FullscreenNestedEscape: Story = {
  args: { createFixture: () => createFixture() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await enter(canvasElement);
    await userEvent.click(header(canvasElement).getByRole("button", { name: /panels$/i }));
    await userEvent.keyboard("{Escape}");
    await expect(fixture.workbench.fullscreen.store.getState().active).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect(fixture.workbench.fullscreen.store.getState().active).toBe(false);
    fixture.workbench.pageLocations.navigate({ kind: "page", page: windowingPages.webview });
    await enter(canvasElement);
    await expect(await canvas.findByTitle("Windowing webview")).toBeVisible();
  },
};

export const FullscreenFocusFallbacks: Story = {
  args: { createFixture: () => createFixture({ regionSettings: { side: { floatable: false } } }) },
  play: async ({ canvasElement }) => {
    await openSession("attached");
    const draft = await within(canvasElement).findByRole("textbox", { name: "Session draft" });
    draft.focus();
    fixture.workbench.fullscreen.enter();
    await waitFor(() => expect(canvasElement.querySelector('[data-workbench-region="main"]')).toHaveFocus());
    await expect(fixture.workbench.focus.getActiveRegion()).toBe("main");
  },
};

export const FullscreenCloseOnlySide: Story = {
  args: { createFixture: () => createFixture({ regionSettings: { side: { canOpen: false, canClose: true } } }) },
  play: async ({ canvasElement }) => {
    await enter(canvasElement);
    await userEvent.click(header(canvasElement).getByRole("button", { name: "Hide Sidebar" }));
    await waitFor(() => expect(canvasElement.querySelector('[data-workbench-region="main"]')).toHaveFocus());
    await expect(header(canvasElement).queryByRole("button", { name: "Show Sidebar" })).toBeNull();
  },
};

export const FullscreenExitBinding: Story = {
  args: {
    createFixture: () => {
      const result = createFixture({ pageRegionSettings: { main: { showHeader: false } } });
      result.workbench.keybindings.registerKeybinding({
        keybinding: "Alt+Enter",
        action: { kind: "command", commandId: "workbench.exitMainFullscreen" },
      });
      return result;
    },
  },
  play: async ({ canvasElement }) => {
    (await within(canvasElement).findByRole("textbox", { name: "Files draft" })).focus();
    await expect(fixture.workbench.focus.getActiveRegion()).toBe("main");
    await enter(canvasElement);
    await userEvent.keyboard("{Alt>}{Enter}{/Alt}");
    await waitFor(() => expect(fixture.workbench.fullscreen.store.getState().active).toBe(false));
    await expect(within(canvasElement).getByRole("button", { name: "Expand page" })).toHaveFocus();
  },
};

export const FullscreenHiddenNavigation: Story = {
  args: {
    createFixture: () =>
      createFixture({
        registerMode: (core) =>
          core.modes.registerMode({
            id: "windowing",
            label: "Windowing",
            chrome: { nav: false },
            activate() {},
          }),
      }),
  },
  play: async ({ canvasElement }) => {
    fixture.workbench.fullscreen.enter();
    const exit = await within(canvasElement).findByRole("button", { name: "Exit fullscreen" });
    await userEvent.click(exit);
    await waitFor(() => expect(canvasElement.querySelector('[data-workbench-region="main"]')).toHaveFocus());
    await expect(fixture.workbench.focus.getActiveRegion()).toBe("main");
  },
};

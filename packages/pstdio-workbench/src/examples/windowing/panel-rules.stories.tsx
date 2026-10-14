import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWindowingFixture, type WindowingFixture } from "./fixture";
import { windowingExtensionId } from "./resources";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
let mixed: WindowingFixture;
let refused: WindowingFixture;
let headers: WindowingFixture;

export const MixedPanelRules: Story = {
  args: {
    createFixture: () => {
      mixed = createWindowingFixture("windowing", {
        pagePanels: true,
        regionSettings: {
          side: { canOpen: false, canClose: false, movable: false, resizable: true, floatable: false },
          secondary: { canOpen: true, canClose: true },
        },
      });
      return mixed;
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("textbox", { name: "Files draft" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Hide Side Panel" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Show Side Panel" })).toBeNull();
    await expect(canvas.getByRole("separator", { name: "Resize Side Panel" })).toBeVisible();
    await expect(mixed.workbench.commands.executeCommand("workbench.closeSidePanel")).rejects.toThrow("disabled");
    await expect(mixed.workbench.commands.executeCommand("workbench.toggleSidePanel")).rejects.toThrow("disabled");
    await userEvent.click(canvas.getByRole("button", { name: "Hide Secondary Panel" }));
    await userEvent.click(canvas.getByRole("button", { name: "Show Secondary Panel" }));
    await expect(canvasElement.querySelector('[data-workbench-panel="secondary"]')).toBeVisible();
    await expect(mixed.workbench.layout.getLayout().regions.secondary.visibility).toBe("open");
    const terminal = mixed.workbench.layout.listPanelInstances("bottom")[0]!;
    mixed.workbench.movePanel(terminal.instanceId, "side");
    await waitFor(() =>
      expect(
        within(canvasElement.querySelector('[data-workbench-panel="side"]') as HTMLElement).getByRole("tab", {
          name: "Terminal",
        }),
      ).toBeVisible(),
    );
    await expect(canvas.queryByRole("button", { name: "Hide Side Panel" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Hide Secondary Panel" }));
    await waitFor(() => expect(canvasElement.querySelector('[data-workbench-panel="secondary"]')).not.toBeVisible());
  },
};

export const RefusedPanelTabs: Story = {
  args: {
    createFixture: () => {
      refused = createWindowingFixture("windowing", {
        pagePanels: true,
        regionSettings: {
          side: { acceptsTabs: false, floatable: false },
          secondary: { canOpen: false, canClose: false, resizable: false },
        },
      });
      return refused;
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("textbox", { name: "Files draft" })).toBeVisible();
    await expect(canvas.queryByRole("separator", { name: "Resize Secondary Panel" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Hide Secondary Panel" })).toBeNull();
    const tab = refused.workbench.layout.listPanelInstances("bottom")[0]!;
    await expect(() => refused.workbench.movePanel(tab.instanceId, "side")).toThrow("cannot move");
    await expect(
      refused.workbench.navigation.openTarget({
        kind: "panel",
        panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
        resource: refused.resources.sessions[0],
      }),
    ).rejects.toThrow("cannot accept tabs");
    await expect(refused.workbench.getPanelDestinations(tab.instanceId)).not.toContain("side");
    await expect(
      canvasElement.querySelector('[data-workbench-panel-header="side"] button[aria-label="Add panel"]'),
    ).toBeNull();
  },
};

export const PanelHeaderChoices: Story = {
  args: {
    createFixture: () => {
      headers = createWindowingFixture("windowing", {
        pagePanels: true,
        regionSettings: {
          secondary: {
            canOpen: false,
            canClose: false,
            acceptsTabs: false,
            movable: false,
            resizable: false,
            showHeader: false,
            size: { defaultPx: 188, minPx: 188, maxPx: 188 },
          },
        },
      });
      const core = headers.workbench;
      core.views.registerView({
        id: "windowing.timeline",
        title: "Timeline",
        body: { kind: "react", render: () => <Text p="md">Timeline content</Text> },
      });
      core.modePlacements.registerPlacement({
        id: "windowing.timeline",
        ref: { kind: "placement", extensionId: windowingExtensionId, id: "timeline" },
        modeId: "windowing",
        region: "secondary",
        item: { kind: "view", presence: "open", view: { kind: "view", id: "windowing.timeline" } },
      });
      const timeline = core.layout.listPanelInstances("secondary").find((tab) => tab.viewId === "windowing.timeline");
      if (timeline) core.layout.activatePanel(timeline.instanceId);
      return headers;
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Timeline content")).toBeVisible();
    await expect(canvas.queryByRole("tab", { name: "Timeline" })).toBeNull();
    canvas.getByLabelText("secondary header edge").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Show header" }));
    await expect(await canvas.findByRole("tab", { name: "Timeline" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Hide Secondary Panel" })).toBeNull();
    await expect(canvas.queryByRole("separator", { name: "Resize Secondary Panel" })).toBeNull();
    await expect(headers.workbench.commands.executeCommand("workbench.closeSecondaryPanel")).rejects.toThrow(
      "disabled",
    );
    const terminal = headers.workbench.layout.listPanelInstances("bottom")[0]!;
    await expect(() => headers.workbench.movePanel(terminal.instanceId, "secondary")).toThrow("cannot move");
    canvas.getByLabelText("secondary header", { exact: true }).focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Hide header" }));
    await waitFor(() => expect(canvas.queryByRole("tab", { name: "Timeline" })).toBeNull());
    await expect(headers.workbench.shell.getPanelPolicy("secondary").showHeader).toBe(false);
    const timeline = headers.workbench.layout
      .listPanelInstances("secondary")
      .find((tab) => tab.viewId === "windowing.timeline")!;
    headers.workbench.movePanel(timeline.instanceId, "side");
    await userEvent.click(await canvas.findByRole("button", { name: "Close Timeline" }));
    await expect(canvas.queryByRole("tab", { name: "Timeline" })).toBeNull();
    await expect(headers.workbench.shell.getRegionState("secondary").open).toBe(true);
  },
};

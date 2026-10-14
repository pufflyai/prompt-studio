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
let fixture: WindowingFixture;

export const FloatingPanelHeaders: Story = {
  args: {
    createFixture: () => {
      fixture = createWindowingFixture("windowing", {
        pagePanels: true,
        regionSettings: { side: { showHeader: false, canOpen: false, canClose: false, acceptsTabs: false } },
      });
      const core = fixture.workbench;
      core.views.registerView({
        id: "floating-inspector",
        title: "Inspector",
        body: { kind: "react", render: () => <Text p="md">Floating inspector</Text> },
      });
      core.modePlacements.registerPlacement({
        id: "floating-inspector",
        ref: { kind: "placement", extensionId: windowingExtensionId, id: "floating-inspector" },
        modeId: "windowing",
        region: "side",
        item: { kind: "view", presence: "fixed", view: { kind: "view", id: "floating-inspector" } },
      });
      core.shell.setSidePanelPresentation("floating");
      return fixture;
    },
  },
  play: async () => {
    const core = fixture.workbench;
    const document = within(globalThis.document.body);
    const panel = within(await document.findByTestId("workbench-side-panel-floating"));
    await waitFor(() => expect(panel.getByText("Floating inspector")).toBeVisible());
    await expect(panel.queryByRole("banner")).toBeNull();
    panel.getByLabelText("side header edge").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(document.getByRole("menuitem", { name: "Show header" }));
    await expect(await panel.findByRole("tab", { name: "Inspector" })).toBeVisible();
    await expect(panel.queryByRole("button", { name: "Close Side Panel" })).toBeNull();
    await expect(panel.queryByRole("button", { name: "Add panel" })).toBeNull();
    await expect(core.commands.executeCommand("workbench.closeSidePanel")).rejects.toThrow("disabled");
    await expect(core.shell.getPanelPolicy("side").acceptsTabs).toBe(false);
    panel.getByLabelText("side header", { exact: true }).focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(document.getByRole("menuitem", { name: "Hide header" }));
    await waitFor(() => expect(panel.queryByRole("banner")).toBeNull());
    core.shell.setSidePanelPresentation("attached");
    await waitFor(() => expect(document.getByTestId("workbench-side-panel-attached")).toBeVisible());
    await expect(within(document.getByTestId("workbench-side-panel-attached")).queryByRole("banner")).toBeNull();
    core.shell.setSidePanelPresentation("floating");
    await waitFor(() => expect(document.getByTestId("workbench-side-panel-floating")).toBeVisible());
    await expect(panel.queryByRole("banner")).toBeNull();
    panel.getByLabelText("side header edge").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(document.getByRole("menuitem", { name: "Show header" }));
    await expect(await panel.findByRole("tab", { name: "Inspector" })).toBeVisible();
  },
};

export const EmptyFloatingPanelHeaders: Story = {
  args: {
    createFixture: () => {
      fixture = createWindowingFixture("windowing", {
        pagePanels: true,
        regionSettings: { side: { showHeader: false } },
      });
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    const core = fixture.workbench;
    const canvas = within(canvasElement);
    const document = within(globalThis.document.body);
    await userEvent.click(await canvas.findByRole("button", { name: "Show Sidebar" }));
    await waitFor(() => expect(canvas.getByTestId("workbench-side-panel-attached")).toBeVisible());
    await expect(within(canvas.getByTestId("workbench-side-panel-attached")).queryByRole("banner")).toBeNull();
    core.shell.setSidePanelPresentation("floating");
    const element = await document.findByTestId("workbench-side-panel-floating");
    const floating = within(element);
    await waitFor(() => expect(element).toBeVisible());
    await userEvent.click(floating.getByLabelText("side header edge"));
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(document.getByRole("menuitem", { name: "Show header" }));
    await expect(await floating.findByRole("banner")).toBeVisible();
    await expect(core.layout.listPanelInstances("side")).toHaveLength(0);
    floating.getByLabelText("side header", { exact: true }).focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(document.getByRole("menuitem", { name: "Hide header" }));
    await waitFor(() => expect(floating.queryByRole("banner")).toBeNull());
    await expect(element).toBeVisible();
    await expect(core.layout.getLayout().regions.side.visibility).toBe("open");
    core.shell.setSidePanelPresentation("attached");
    await waitFor(() => expect(canvas.getByTestId("workbench-side-panel-attached")).toBeVisible());
    await expect(
      within(canvas.getByTestId("workbench-side-panel-attached")).getByText("Drop a tab here"),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Hide Sidebar" }));
    await waitFor(() => expect(canvas.getByTestId("workbench-side-panel-attached")).not.toBeVisible());
  },
};

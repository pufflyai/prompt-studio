import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { emptyWorkbenchExtensionMetadata } from "../../extensions/contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "../../extensions/host/workbench-extension-host";
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

export const LegacyPanelHeaders: Story = {
  args: {
    createFixture: () =>
      (fixture = createWindowingFixture("windowing", {
        pagePanels: true,
        registerMode: (workbench) => {
          return registerWorkbenchExtensionContributions({
            projectId: "windowing-project",
            workbench,
            executeCommand: () => undefined,
            metadata: {
              ...emptyWorkbenchExtensionMetadata,
              modes: [
                {
                  id: "windowing",
                  localId: "windowing",
                  extensionId: "storybook.windowing",
                  label: "Windowing",
                  regions: ["main", "side", "secondary"],
                  regionSettings: {
                    main: { showHeader: false, acceptsTabs: true },
                    side: { showHeader: false, acceptsTabs: true },
                    secondary: {
                      showHeader: false,
                      alwaysShowTabs: false,
                      canOpen: true,
                      canClose: false,
                      collapsible: false,
                    },
                  },
                },
              ],
            },
          });
        },
      })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("tab", { name: "Files" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Changes" })).toBeVisible();
    await expect(canvasElement.querySelector('[data-workbench-panel-header="main"]')).toBeVisible();
    await expect(canvas.queryByRole("tab", { name: "Mode tools" })).toBeNull();
    await expect(canvasElement.querySelector('[data-workbench-panel-header="secondary"]')).not.toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Hide Secondary Panel" })).toBeNull();
    await fixture.workbench.shell.setSidePanelPresentation("floating");
    const document = within(globalThis.document.body);
    const floating = within(await document.findByTestId("workbench-side-panel-floating"));
    await waitFor(() => expect(floating.getByRole("banner")).toBeVisible());
    fixture.workbench.shell.setHeaderVisible("side", false);
    await waitFor(() => expect(floating.queryByRole("banner")).toBeNull());
    await expect(document.getByTestId("workbench-side-panel-floating")).toBeVisible();
    await userEvent.click(floating.getByLabelText("side header edge"));
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(document.getByRole("menuitem", { name: "Show header" }));
    await expect(await floating.findByRole("banner")).toBeVisible();
  },
};

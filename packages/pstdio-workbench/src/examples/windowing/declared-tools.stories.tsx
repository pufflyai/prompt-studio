import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { emptyWorkbenchExtensionMetadata } from "../../extensions/contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "../../extensions/host/workbench-extension-host";
import { createWindowingFixture } from "./fixture";
import { windowingExtensionId } from "./resources";
import { moveStoryTab } from "./tab-moves";
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

export const ProposalReopen: Story = {
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
    const main = within(panel(canvasElement, "main"));
    await userEvent.click(await main.findByRole("button", { name: "Close Proposal" }));
    await expect(main.getByText("Drop a tab here")).toBeVisible();
    const content = main.getByText("Drop a tab here").closest(".chakra-empty-state__content")!;
    const region = panel(canvasElement, "main").querySelector('section[aria-label="Main"]')!;
    const contentBounds = content.getBoundingClientRect();
    const regionBounds = region.getBoundingClientRect();
    await expect(
      Math.abs(contentBounds.top + contentBounds.height / 2 - regionBounds.top - regionBounds.height / 2),
    ).toBeLessThan(2);
    await userEvent.click(main.getByRole("button", { name: "Open Proposal" }));
    await expect(await main.findByRole("tab", { name: "Proposal" })).toBeVisible();
    await expect(within(canvasElement).getByText("Inspector")).toBeVisible();
  },
};

const boomboxFixture = () => {
  const fixture = createWindowingFixture("boombox");
  fixture.workbench.shell.setHeaderVisible("secondary", true);
  fixture.workbench.shell.setHeaderVisible("side", true);
  fixture.workbench.shell.setHeaderVisible("main", true);
  return fixture;
};

export const PlayerReopen: Story = {
  args: { createFixture: boomboxFixture },
  play: async ({ canvasElement }) => {
    const bottom = within(panel(canvasElement, "secondary"));
    await userEvent.click(await bottom.findByRole("button", { name: "Close Player" }));
    await expect(bottom.queryByText("Drop a tab here")).toBeNull();
    const button = bottom.getByRole("button", { name: "Open Player" });
    await expect(button).toBeVisible();
    const bounds = button.getBoundingClientRect();
    const container = panel(canvasElement, "secondary").getBoundingClientRect();
    await expect(bounds.top).toBeGreaterThanOrEqual(container.top);
    await expect(bounds.bottom).toBeLessThanOrEqual(container.bottom);
    await userEvent.click(button);
    await expect(await bottom.findByRole("tab", { name: "Player" })).toBeVisible();
    await expect(bottom.getByRole("button", { name: "Pause" })).toBeVisible();
  },
};

export const MovedDeclaredTool: Story = {
  args: { createFixture: boomboxFixture },
  play: async ({ canvasElement }) => {
    const side = within(panel(canvasElement, "side"));
    const tab = await side.findByRole("tab", { name: "Up next" });
    await moveStoryTab(tab, "Main");
    await expect(side.queryByText("Drop a tab here")).toBeNull();
    await userEvent.click(side.getByRole("button", { name: "Open Up next" }));
    await waitFor(() =>
      expect(within(panel(canvasElement, "main")).getByRole("tab", { name: "Up next" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    await expect(within(canvasElement).getAllByRole("tab", { name: "Up next" })).toHaveLength(1);
  },
};

export const LegacyFixedTool: Story = {
  args: {
    createFixture: () => {
      const fixture = createWindowingFixture("windowing", { pagePanels: true });
      const workbench = fixture.workbench;
      workbench.views.registerView({
        id: "legacy.view.tool",
        title: "Legacy tool",
        body: { kind: "react", render: () => <Text>Legacy tool content</Text> },
      });
      registerWorkbenchExtensionContributions({
        workbench,
        projectId: "windowing-project",
        executeCommand: () => undefined,
        metadata: {
          ...emptyWorkbenchExtensionMetadata,
          modes: [
            {
              id: "legacy.mode.main",
              extensionId: "legacy",
              localId: "main",
              label: "Legacy",
              regions: ["main", "side", "secondary"],
            },
          ],
          pages: [
            {
              id: "legacy.page.home",
              extensionId: "legacy",
              localId: "home",
              title: "Legacy home",
              path: "legacy/home",
              mode: { kind: "mode", extensionId: "legacy", id: "main" },
              main: { kind: "view", view: { kind: "view", extensionId: "legacy", id: "tool" }, cardinality: "one" },
              slots: [],
            },
          ],
          placements: [
            {
              id: "legacy.placement.tool",
              extensionId: "legacy",
              localId: "tool",
              mode: { kind: "mode", extensionId: "legacy", id: "main" },
              region: "side",
              movableTo: ["side"],
              item: { kind: "view", presence: "fixed", view: { kind: "view", extensionId: "legacy", id: "tool" } },
            },
          ],
        },
      });
      workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "legacy", id: "home" } });
      workbench.shell.setHeaderVisible("side", true);
      return fixture;
    },
  },
  play: async ({ canvasElement }) => {
    const side = within(panel(canvasElement, "side"));
    await expect(await side.findByRole("tab", { name: "Legacy tool" })).toBeVisible();
    await expect(side.queryByRole("button", { name: "Close Legacy tool" })).toBeNull();
  },
};

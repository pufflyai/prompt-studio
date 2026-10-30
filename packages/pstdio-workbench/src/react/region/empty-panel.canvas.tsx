import { Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const createEmptyWorkbench = (pageEntries = false) => {
  const workbench = createWorkbench({ initialSidePanelMode: "attached" });
  workbench.modes.registerMode({
    id: "tools",
    activate() {},
  });
  for (const [id, title] of [
    ["terminal", "Terminal"],
    ["session", "Session"],
    ["inspector", "Inspector"],
  ]) {
    workbench.views.registerView({
      id,
      title,
      icon: id === "terminal" ? "Terminal" : undefined,
      body: { kind: "react", render: () => <Text p="md">{title} content</Text> },
    });
    workbench.modePlacements.registerPlacement({
      id,
      ref: { kind: "placement", extensionId: "example", id },
      modeId: "tools",
      region: "side",
      ...(id === "inspector" ? { movableTo: ["side"] } : {}),
      item: { kind: "view", view: { kind: "view", id }, presence: "closed" },
    });
  }
  const page = { kind: "page", extensionId: "example", id: "tools" } as const;
  if (pageEntries)
    for (const [id, title] of [
      ["changes", "Changes"],
      ["new-page", "New page"],
    ]) {
      workbench.views.registerView({
        id,
        title,
        icon: "FilePlus",
        body: { kind: "react", render: () => <Text p="md">{title} content</Text> },
      });
    }
  workbench.pages.registerPage({
    id: "tools",
    ref: page,
    title: "Tools",
    path: "tools",
    modeId: "tools",
    main: { kind: "panels" },
    slots: pageEntries
      ? ["changes", "new-page"].map((id) => ({
          id,
          region: "main" as const,
          item: { kind: "view" as const, view: { kind: "view" as const, id }, presence: "closed" as const },
        }))
      : [],
  });
  workbench.pageLocations.setProject("storybook-empty-panels");
  workbench.pageLocations.navigate({ kind: "page", page });
  workbench.shell.setSidePanelPresentation("attached");
  workbench.shell.setRegionOpen("secondary", true);
  return workbench;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Empty panel",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const AvailableTabs: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--available-tabs",
  args: { workbench: createEmptyWorkbench() },
};
export const NarrowPanel: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--narrow-panel",
  args: { workbench: createEmptyWorkbench() },
};
export const PageEntries: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--page-entries",
  args: { workbench: createEmptyWorkbench(true) },
};
export const TopAlignedCards: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--top-aligned-cards",
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench(true);
      workbench.shell.setRegionOpen("side", false);
      workbench.shell.setRegionOpen("secondary", false);
      return workbench;
    })(),
  },
};
export const OpenInMain: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--open-in-main",
  args: { workbench: createEmptyWorkbench() },
};
export const ShortcutPreview: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--shortcut-preview",
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench();
      workbench.keyboard.setPreview(true);
      return workbench;
    })(),
  },
};
export const OpenInSide: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--open-in-side",
  args: { workbench: createEmptyWorkbench() },
};
export const OpenInBottom: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--open-in-bottom",
  args: { workbench: createEmptyWorkbench() },
};
export const CustomPlaceholders: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--custom-placeholders",
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench();
      workbench.views.registerView({
        id: "custom-placeholder",
        title: "Custom placeholder",
        body: { kind: "react", render: () => <Text p="md">Custom panel content</Text> },
      });
      for (const region of ["main", "side"] as const)
        workbench.placeholders.registerPlaceholder({ id: `custom-${region}`, viewId: "custom-placeholder", region });
      return workbench;
    })(),
  },
};
export const SelectingMode: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--selecting-mode",
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench();
      workbench.pageLocations.clearProject();
      workbench.modes.setActiveMode(undefined);
      workbench.shellPlacements.registerPlacement({
        id: "loading-terminal",
        region: "main",
        item: { kind: "view", view: { kind: "view", id: "terminal" }, presence: "closed" },
      });
      return workbench;
    })(),
  },
};
export const TabsDisabled: Story = {
  id: "pstdio-workbench-reference-core-api-empty-panel--tabs-disabled",
  tags: ["panel-placeholder-policy"],
  args: {
    workbench: (() => {
      const workbench = createEmptyWorkbench();
      workbench.modes.registerMode({
        id: "selection",
        panels: [],
        regionSettings: { main: { acceptsTabs: false, showHeader: false } },
        activate() {},
      });
      workbench.pageLocations.clearProject();
      workbench.modes.setActiveMode("selection");
      return workbench;
    })(),
  },
};

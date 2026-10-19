import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { createWorkbench } from "../../core";
import type { WorkbenchRegionSettings } from "../../core/registries/layout/layout-types";
import { WorkbenchStory } from "../../examples/workbench-story";

const createPolicyWorkbench = (settings: WorkbenchRegionSettings = {}, legacy = false) => {
  const page = { kind: "page", extensionId: "storybook", id: "policy" } as const;
  const w = createWorkbench({ startPage: page, initialSidePanelMode: "attached" });
  w.modes.registerMode({
    id: "policy",
    activate() {},
    panelHeaders: legacy ? "legacy" : undefined,
    chrome: { status: "status" },
    regionSettings: { main: { showHeader: false }, side: settings, secondary: settings },
  });
  for (const [id, title] of [
    ["main", "Main page"],
    ["side", "Session"],
    ["secondary", "Terminal"],
    ["status", "Mode status"],
  ]) {
    w.views.registerView({
      id,
      title,
      body: {
        kind: "react",
        render: () => (
          <Box p="md">
            <Text>{title} content</Text>
          </Box>
        ),
      },
    });
  }
  w.pages.registerPage({
    id: "policy",
    ref: page,
    path: "policy",
    modeId: "policy",
    main: { kind: "view", view: { kind: "view", id: "main" }, cardinality: "one" },
    slots: [],
  });
  for (const region of ["side", "secondary"] as const) {
    w.modePlacements.registerPlacement({
      id: region,
      ref: { kind: "placement", extensionId: "storybook", id: region },
      modeId: "policy",
      region,
      item: { kind: "view", view: { kind: "view", id: region }, presence: "open" },
    });
  }
  w.pageLocations.switchProject("panel-policy");
  w.pageLocations.navigate({ kind: "page", page });
  return w;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel policy",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SharedControls: Story = {
  args: { workbench: createPolicyWorkbench() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const footer = canvasElement.querySelector('[data-workbench-region="status"]') as HTMLElement;
    await expect(within(footer).getByRole("button", { name: "Hide Side Panel" })).toBeVisible();
    await expect(within(footer).getByRole("button", { name: "Hide Bottom Panel" })).toBeVisible();
    await expect(canvas.getByText("Mode status content")).toBeVisible();
  },
};
export const HiddenHeaders: Story = { args: { workbench: createPolicyWorkbench({ showHeader: false }) } };
export const RestrictedPanels: Story = {
  args: {
    workbench: createPolicyWorkbench({
      canOpen: true,
      canClose: false,
      acceptsTabs: false,
      resizable: false,
      floatable: false,
    }),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Session content")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Hide Side Panel" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Hide Bottom Panel" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Float Side Panel" })).toBeNull();
    await expect(canvas.queryByRole("separator", { name: "Resize Side Panel" })).toBeNull();
    expect(() => args.workbench.shell.setRegionOpen("side", false)).toThrow("cannot close");
  },
};
export const LegacyHeaders: Story = { args: { workbench: createPolicyWorkbench({ showHeader: false }, true) } };
export const FloatingHeader: Story = {
  args: {
    workbench: (() => {
      const w = createPolicyWorkbench();
      w.shell.setSidePanelPresentation("floating");
      return w;
    })(),
  },
};

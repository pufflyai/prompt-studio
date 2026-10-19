import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createPolicyWorkbench } from "./panel-policy.fixture";

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
    const nav = canvasElement.querySelector('[data-workbench-region="nav"]') as HTMLElement;
    const footer = canvasElement.querySelector('[data-workbench-region="status"]') as HTMLElement;
    await expect(within(nav).getByRole("button", { name: "Hide Side Panel" })).toBeVisible();
    await expect(within(nav).getByRole("button", { name: "Hide Bottom Panel" })).toBeVisible();
    await expect(within(footer).queryByRole("group", { name: "Panel controls" })).toBeNull();
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

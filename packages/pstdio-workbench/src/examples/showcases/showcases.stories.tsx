import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { WorkbenchStory } from "../workbench-story";
import { createBoomboxWorkbench } from "./boombox";
import { createKilnWorkbench } from "./kiln";
import { createPigeonWorkbench } from "./pigeon";
import { createScribbleWorkbench } from "./scribble";
import { boomboxTheme, kilnTheme, pigeonTheme, scribbleTheme, ziplineTheme } from "./themes";
import { createZiplineWorkbench } from "./zipline";

const meta = {
  title: "pstdio-workbench/Showcases",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "These host examples use direct Workbench registries and React bodies. For complete public extension versions of all five showcases, see extensions/extension-lab/src/examples. Their dashboard journeys are covered by public-page-patterns.spec.ts.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ScribbleStory = () => {
  const [workbench] = useState(createScribbleWorkbench);
  return <WorkbenchStory workbench={workbench} initialThemePreference={scribbleTheme.id} />;
};

const BoomboxStory = () => {
  const [workbench] = useState(createBoomboxWorkbench);
  return <WorkbenchStory workbench={workbench} initialThemePreference={boomboxTheme.id} />;
};

const ZiplineStory = () => {
  const [workbench] = useState(createZiplineWorkbench);
  return <WorkbenchStory workbench={workbench} initialThemePreference={ziplineTheme.id} />;
};

const PigeonStory = () => {
  const [workbench] = useState(createPigeonWorkbench);
  return <WorkbenchStory workbench={workbench} initialThemePreference={pigeonTheme.id} />;
};

const KilnStory = () => {
  const [workbench] = useState(createKilnWorkbench);
  return <WorkbenchStory workbench={workbench} initialThemePreference={kilnTheme.id} />;
};

export const Scribble: Story = {
  render: ScribbleStory,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-workbench-region="sidenav"]')).toBeVisible();
  },
};
export const Boombox: Story = {
  render: BoomboxStory,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const player = canvasElement.querySelector('[data-workbench-region="secondary"]');
    await userEvent.click(await canvas.findByRole("button", { name: "Hide Secondary Panel" }));
    await expect(player).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Show Secondary Panel" }));
    await expect(player).toBeVisible();
    await expect(canvasElement.querySelector('[data-workbench-region="secondary"]')).toBe(player);
  },
};
export const Zipline: Story = {
  render: ZiplineStory,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-workbench-region="sidenav"]')).toBeVisible();
  },
};
export const Pigeon: Story = {
  render: PigeonStory,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-workbench-region="sidenav"]')).toBeVisible();
  },
};
export const Kiln: Story = {
  render: KilnStory,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("spinbutton", { name: "Cube position X" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Float Side Panel" })).toBeNull();
    const position = canvas.getByRole("spinbutton", { name: "Cube position X" });
    await userEvent.clear(position);
    await userEvent.type(position, "2.5");
    for (const panel of ["Side", "Secondary"]) {
      await userEvent.click(canvas.getByRole("button", { name: `Hide ${panel} Panel` }));
      await userEvent.click(canvas.getByRole("button", { name: `Show ${panel} Panel` }));
    }
    await expect(canvas.getByRole("spinbutton", { name: "Cube position X" })).toHaveValue(2.5);
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
    for (const region of ["side", "secondary"]) {
      await expect(canvasElement.querySelector(`[data-workbench-panel-header="${region}"]`)).toBeNull();
    }
  },
};

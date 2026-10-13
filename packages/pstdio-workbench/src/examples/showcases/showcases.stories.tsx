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
    await expect(canvasElement.querySelector('[data-workbench-region="secondary"]')).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Hide Secondary Panel" })).toBeNull();
    await expect(canvasElement.querySelector('[data-workbench-region="sidenav"]')).not.toBeVisible();
    await expect(await canvas.findByRole("tab", { name: "Up next" })).toBeVisible();
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
    for (const panel of ["Side", "Secondary"])
      await expect(canvas.queryByRole("button", { name: `Hide ${panel} Panel` })).toBeNull();
    await expect(canvas.getByRole("spinbutton", { name: "Cube position X" })).toHaveValue(2.5);
    await userEvent.keyboard("{Escape}");
    const edge = canvas.getByLabelText("secondary header edge");
    edge.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Show header" }));
    await expect(await canvas.findByRole("tab", { name: "Timeline" })).toBeVisible();
    await expect(canvas.queryByRole("separator", { name: "Resize Secondary Panel" })).toBeNull();
  },
};

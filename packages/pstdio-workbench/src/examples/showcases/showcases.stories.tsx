import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";
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
          "These host examples use direct Workbench registries and React bodies. For complete public extension versions of Scribble, Zipline, and Pigeon, see extensions/extension-lab/src/examples. Their dashboard journeys are covered by public-page-patterns.spec.ts.",
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

export const Scribble: Story = { render: ScribbleStory };
export const Boombox: Story = { render: BoomboxStory };
export const Zipline: Story = { render: ZiplineStory };
export const Pigeon: Story = { render: PigeonStory };
export const Kiln: Story = {
  render: KilnStory,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("spinbutton", { name: "Cube position X" })).toBeVisible();
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
    for (const region of ["side", "secondary"]) {
      await expect(canvasElement.querySelector(`[data-workbench-panel-header="${region}"]`)).toBeNull();
    }
  },
};

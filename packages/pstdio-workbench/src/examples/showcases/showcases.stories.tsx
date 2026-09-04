import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { WorkbenchStory } from "../workbench-story";
import { createBoomboxWorkbench } from "./boombox";
import { createPigeonWorkbench } from "./pigeon";
import { createScribbleWorkbench } from "./scribble";
import { boomboxTheme, pigeonTheme, scribbleTheme, ziplineTheme } from "./themes";
import { createZiplineWorkbench } from "./zipline";

const meta = {
  title: "pstdio-workbench/Showcases",
  parameters: { layout: "fullscreen" },
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

export const Scribble: Story = { render: ScribbleStory };
export const Boombox: Story = { render: BoomboxStory };
export const Zipline: Story = { render: ZiplineStory };
export const Pigeon: Story = { render: PigeonStory };

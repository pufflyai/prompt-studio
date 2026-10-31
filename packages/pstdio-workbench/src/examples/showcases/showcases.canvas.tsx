import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { WorkbenchStory } from "../workbench-story";
import { createBoomboxWorkbench } from "./boombox";
import { createKilnWorkbench } from "./kiln";
import { createPigeonWorkbench } from "./pigeon";
import { createScribbleWorkbench } from "./scribble";
import { boomboxTheme, kilnTheme, pigeonTheme, scribbleTheme, ziplineTheme } from "./themes";
import { createZiplineWorkbench } from "./zipline";

const meta = {
  title: "pstdio-workbench/Showcases",
  description:
    "These host examples use direct Workbench registries and React bodies. For complete public extension versions of all five showcases, see extensions/extension-lab/src/examples. Their dashboard journeys are covered by public-page-patterns.p2.spec.ts.",
  fullscreen: true,
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
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
  id: "pstdio-workbench-showcases--scribble",
  render: ScribbleStory,
};
export const Boombox: Story = {
  id: "pstdio-workbench-showcases--boombox",
  render: BoomboxStory,
};
export const Zipline: Story = {
  id: "pstdio-workbench-showcases--zipline",
  render: ZiplineStory,
};
export const Pigeon: Story = {
  id: "pstdio-workbench-showcases--pigeon",
  render: PigeonStory,
};
export const Kiln: Story = {
  id: "pstdio-workbench-showcases--kiln",
  render: KilnStory,
};

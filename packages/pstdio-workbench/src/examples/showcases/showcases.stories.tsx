import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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

let boombox: ReturnType<typeof createBoomboxWorkbench>;
let kiln: ReturnType<typeof createKilnWorkbench>;

const BoomboxStory = () => {
  const [workbench] = useState(() => (boombox = createBoomboxWorkbench()));
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
  const [workbench] = useState(() => (kiln = createKilnWorkbench()));
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
    await expect(canvas.queryAllByRole("tab")).toHaveLength(0);
    for (const region of ["main", "side", "secondary"] as const) {
      await expect(boombox.shell.getPanelPolicy(region).showHeader).toBe(false);
      boombox.shell.setHeaderVisible(region, true);
    }
    for (const [title, region] of [
      ["Up next", "side"],
      ["Player", "secondary"],
    ] as const) {
      const tab = boombox.layout.listPanelInstances(region)[0]!;
      await expect(await canvas.findByRole("button", { name: `Close ${title}` })).toBeVisible();
      boombox.movePanel(tab.instanceId, "main");
      await waitFor(() =>
        expect(boombox.layout.listPanelInstances("main").some((item) => item.instanceId === tab.instanceId)).toBe(true),
      );
      await userEvent.click(canvas.getByRole("button", { name: `Close ${title}` }));
      const reopen = boombox.composition.panelsFor("main").addable.find((item) => item.panelId === tab.panelId);
      await expect(reopen).toBeDefined();
      await reopen!.open?.();
      await expect(await canvas.findByRole("tab", { name: title })).toBeVisible();
    }
    await expect(canvas.queryByRole("button", { name: "Hide Secondary Panel" })).toBeNull();
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
    await expect(canvas.queryByRole("button", { name: "Hide Secondary Panel" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Hide Side Panel" }));
    await expect(canvasElement.querySelector('[data-workbench-region="secondary"]')).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Show Side Panel" }));
    await expect(canvas.getByRole("spinbutton", { name: "Cube position X" })).toHaveValue(2.5);
    await userEvent.keyboard("{Escape}");
    const edge = canvas.getByLabelText("secondary header edge");
    edge.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Show header" }));
    await expect(await canvas.findByRole("tab", { name: "Timeline" })).toBeVisible();
    await expect(canvas.queryByRole("separator", { name: "Resize Secondary Panel" })).toBeNull();
    const timeline = kiln.layout.listPanelInstances("secondary")[0]!;
    kiln.movePanel(timeline.instanceId, "side");
    await waitFor(() =>
      expect(kiln.layout.listPanelInstances("side").some((item) => item.instanceId === timeline.instanceId)).toBe(true),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Close Timeline" }));
    const reopen = kiln.composition.panelsFor("side").addable.find((item) => item.panelId === timeline.panelId);
    await expect(reopen).toBeDefined();
    await reopen!.open?.();
    await expect(await canvas.findByRole("tab", { name: "Timeline" })).toBeVisible();
    for (const tab of kiln.layout.getLayout().regions.side.widgets) kiln.closePlacement(tab.placementIdentity!);
    await kiln.shell.setRegionOpen("side", false);
    await kiln.shell.setRegionOpen("side", true);
    await expect(await canvas.findByRole("tab", { name: "Session 2" })).toBeVisible();
    await kiln.shell.setRegionOpen("side", true);
    await expect(kiln.layout.listPanelInstances("side")).toHaveLength(1);
  },
};

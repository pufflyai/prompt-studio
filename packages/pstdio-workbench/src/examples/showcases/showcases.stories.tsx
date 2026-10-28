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
          "These host examples use direct Workbench registries and React bodies. For complete public extension versions of all five showcases, see extensions/extension-lab/src/examples. Their dashboard journeys are covered by public-page-patterns.p2.spec.ts.",
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
  tags: ["scribble-tabs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("option", { name: "Field notes" }));
    await expect(canvas.getByRole("tab", { name: "North star" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Field notes" })).toBeVisible();
    const search = canvas.getByRole("textbox", { name: "Search pages" });
    await userEvent.type(search, "coffee");
    await expect(await canvas.findByRole("option", { name: "Oslo weekend" })).toBeVisible();
    await expect(canvas.queryByRole("option", { name: "Field notes" })).toBeNull();
    await userEvent.clear(search);
    await userEvent.click(await canvas.findByRole("option", { name: "New page" }));
    await expect(await canvas.findByRole("tab", { name: "Untitled page" })).toBeVisible();
  },
};
export const Boombox: Story = {
  render: BoomboxStory,
  tags: ["showcase-selection"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByLabelText("Main panel header", { exact: true })).toBeNull();
    const player = canvasElement.querySelector('[data-workbench-region="secondary"]');
    await userEvent.click(await canvas.findByRole("button", { name: "Play Afterimage by Hollow Coast" }));
    await expect(player).toBeVisible();
    await expect(within(player as HTMLElement).getByText("Afterimage", { exact: true })).toBeVisible();
  },
};
export const Zipline: Story = {
  render: ZiplineStory,
  tags: ["showcase-selection"],
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-workbench-region="sidenav"]')).toBeVisible();
    await expect(
      within(canvasElement).getByRole("tab", { name: "My issues" }).querySelector("svg.lucide-list-todo"),
    ).toBeVisible();
  },
};
export const Pigeon: Story = {
  render: PigeonStory,
  tags: ["showcase-selection"],
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-workbench-region="sidenav"]')).toBeVisible();
    const canvas = within(canvasElement);
    const inbox = await canvas.findByRole("button", { name: "Refresh inbox" });
    await expect(canvas.queryByLabelText("Main panel header", { exact: true })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Open message: Launch notes for Friday" }));
    const reader = within(await within(canvasElement.ownerDocument.body).findByTestId("workbench-side-panel-floating"));
    await expect(await reader.findByText("Launch notes for Friday", { exact: true })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Refresh inbox" })).toBe(inbox);
  },
};
export const Kiln: Story = {
  render: KilnStory,
  tags: ["showcase-selection"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByLabelText("Main panel header", { exact: true })).toBeNull();
    await expect(await canvas.findByRole("spinbutton", { name: "Cube position X" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Float Side Panel" })).toBeNull();
    const position = canvas.getByRole("spinbutton", { name: "Cube position X" });
    await userEvent.clear(position);
    await userEvent.type(position, "2.5");
    await userEvent.click(canvas.getByRole("button", { name: "Sphere" }));
    await expect(canvas.getByRole("spinbutton", { name: "Sphere position X" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Cube" }));
    await expect(canvas.getByRole("spinbutton", { name: "Cube position X" })).toHaveValue(2.5);
    const main = within(canvasElement.querySelector('[data-workbench-panel="main"]') as HTMLElement);
    await expect(main.queryAllByRole("tab")).toHaveLength(0);
    await expect(canvas.getByRole("tab", { name: "Scene and properties" })).toBeVisible();
  },
};

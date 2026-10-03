import { createWorkbench } from "@pstdio/workbench";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DesktopProjectTabsController } from "../desktop-project-tabs-controller";
import { DesktopProjectTabs } from "./desktop-project-tabs";

const ProjectTabsStory = () => {
  const [workbench] = useState(() => createWorkbench());
  const [controller] = useState(() => new DesktopProjectTabsController([], async () => {}));
  return <DesktopProjectTabs workbench={workbench} controller={controller} platform="darwin" />;
};

const meta = {
  title: "Dashboard/Project tabs",
  component: ProjectTabsStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProjectTabsStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OpenProjectHover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("button", { name: "Open / create project" }));
    const tooltip = await within(canvasElement.ownerDocument.body).findByRole("tooltip");
    await expect(tooltip).toHaveTextContent("Open / create project");
  },
};

export const OpenProjectFocus: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(within(canvasElement).getByRole("button", { name: "Open / create project" })).toHaveFocus();
    const tooltip = await within(canvasElement.ownerDocument.body).findByRole("tooltip");
    await expect(tooltip).toHaveTextContent("Open / create project");
  },
};

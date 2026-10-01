import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { Workbench, WorkbenchThemeProvider } from "../index";

interface MenuWorkbenchOptions {
  closed?: readonly ("left" | "right")[];
  both?: boolean;
}

const createMenuWorkbench = (options: MenuWorkbenchOptions) => {
  const page = { extensionId: "storybook", kind: "page" as const, id: "menus" };
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: "menus", activate: () => undefined });
  workbench.views.registerView({
    id: "document",
    title: "Document",
    body: { kind: "react", render: () => <Text p="md">Project notes</Text> },
  });
  for (const side of options.both ? (["left", "right"] as const) : (["right"] as const)) {
    workbench.views.registerView({
      id: side,
      title: `${side} inspector`,
      body: {
        kind: "react",
        render: () => (
          <Box p="sm" overflow="auto" h="full">
            <Text>Inspector details</Text>
          </Box>
        ),
      },
    });
    workbench.viewMenus.registerViewMenu({ id: side, ownerViewId: "document", viewId: side, side });
  }
  workbench.pages.registerPage({
    id: "menus",
    ref: page,
    title: "Notes",
    path: "menus",
    modeId: "menus",
    slots: [],
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
  });
  workbench.pageLocations.switchProject("menu-stories");
  for (const side of options.closed ?? []) {
    const menu = workbench.layout.getLayout().regions[`main-${side}-menu`].widgets[0];
    workbench.panelMenuState.setOpen(`panel-menu:${menu.widgetId}`, false);
  }
  return workbench;
};

interface PanelMenuStoryProps {
  width: number;
  menus: MenuWorkbenchOptions;
}

const PanelMenuStory = (props: PanelMenuStoryProps) => {
  const { width, menus } = props;
  // One workbench per mount, so a rerun of a play function starts from the story's initial menu state.
  const [workbench] = useState(() => createMenuWorkbench(menus));
  return (
    <WorkbenchThemeProvider>
      <Box data-testid="panel-menu-story-frame" w={width} h="100dvh">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel menus",
  component: PanelMenuStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PanelMenuStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReopenAttached: Story = {
  args: { width: 450, menus: { closed: ["right"] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Open Main right menu" }));
    await waitFor(() => expect(canvasElement.querySelector('[data-workbench-panel-menu="main-right"]')).toBeVisible());
    await expect(canvas.queryByRole("button", { name: "Open Main right menu" })).toBeNull();
    await userEvent.dblClick(canvas.getByRole("separator", { name: "Resize Main right menu" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Open Main right menu" }));
    await waitFor(() => expect(canvasElement.querySelector('[data-workbench-panel-menu="main-right"]')).toBeVisible());
  },
};

export const FloatingWhenNarrow: Story = {
  args: { width: 240, menus: { closed: ["right"] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Open Main right menu" }));
    const floating = await within(canvasElement.ownerDocument.body).findByRole("menu", {
      name: "Main right menu controls",
    });
    await waitFor(() => {
      const bounds = floating.getBoundingClientRect();
      const viewport = canvasElement.ownerDocument.defaultView!.innerHeight;
      expect(bounds.height).toBeGreaterThan(viewport - bounds.top - 20);
      expect(bounds.bottom).toBeLessThanOrEqual(viewport);
    });
  },
};

export const BothMenusAttached: Story = {
  args: { width: 450, menus: { both: true } },
  play: async ({ canvasElement }) => {
    for (const side of ["left", "right"]) {
      await waitFor(() =>
        expect(canvasElement.querySelector(`[data-workbench-panel-menu="main-${side}"]`)).toBeVisible(),
      );
    }
    const content = within(canvasElement).getByText("Project notes");
    await expect(content.getBoundingClientRect().width).toBeGreaterThanOrEqual(120);
    const divider = within(canvasElement).getByRole("separator", { name: "Resize Main left menu" });
    divider.focus();
    await userEvent.keyboard("{End}");
    await expect(content.getBoundingClientRect().width).toBeGreaterThanOrEqual(120);
  },
};

export const OneMenuFits: Story = {
  args: { width: 350, menus: { both: true } },
};

export const FloatingPeekKeepsAttachedMenu: Story = {
  args: { width: 350, menus: { both: true, closed: ["left"] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rightMenu = () => canvasElement.querySelector('[data-workbench-panel-menu="main-right"]');
    await waitFor(() => expect(rightMenu()).toBeVisible());
    await userEvent.click(await canvas.findByRole("button", { name: "Open Main left menu" }));
    await within(canvasElement.ownerDocument.body).findByRole("menu", { name: "Main left menu controls" });
    await expect(canvasElement.querySelector('[data-workbench-panel-menu="main-left"]')).not.toBeVisible();
    await expect(rightMenu()).toBeVisible();
  },
};

export const FloatingPeekKeepsOpenPreference: Story = {
  args: { width: 240, menus: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Open Main right menu" }));
    await within(canvasElement.ownerDocument.body).findByRole("menu", { name: "Main right menu controls" });
    await userEvent.keyboard("{Escape}");
    canvas.getByTestId("panel-menu-story-frame").style.width = "450px";
    await waitFor(() => expect(canvasElement.querySelector('[data-workbench-panel-menu="main-right"]')).toBeVisible());
  },
};

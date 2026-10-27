import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { Workbench, WorkbenchThemeProvider } from "../index";

const createTablessWorkbench = (withMenu: boolean) => {
  const page = { extensionId: "storybook", kind: "page" as const, id: "board" };
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: "board", activate: () => undefined });
  workbench.views.registerView({
    id: "board",
    title: "Board",
    body: { kind: "react", render: () => <Text p="md">Board content</Text> },
  });
  if (withMenu) {
    workbench.views.registerView({
      id: "properties",
      title: "Properties",
      body: { kind: "react", render: () => <Text p="sm">Board properties</Text> },
    });
    workbench.viewMenus.registerViewMenu({
      id: "properties",
      ownerViewId: "board",
      viewId: "properties",
      side: "right",
    });
  }
  workbench.pages.registerPage({
    id: "board",
    ref: page,
    title: "Board",
    path: "board",
    modeId: "board",
    slots: [],
    main: { kind: "view", presentation: "page", view: { kind: "view", id: "board" }, cardinality: "one" },
  });
  workbench.pageLocations.switchProject("page-menu-header-stories");
  const menu = workbench.layout.getLayout().regions["main-right-menu"].widgets[0];
  if (menu) workbench.panelMenuState.setOpen(`panel-menu:${menu.widgetId}`, false);
  return workbench;
};

interface PageMenuHeaderStoryProps {
  withMenu: boolean;
}

const PageMenuHeaderStory = (props: PageMenuHeaderStoryProps) => {
  const { withMenu } = props;
  // One workbench per mount, so a rerun of a play function starts with the menu closed.
  const [workbench] = useState(() => createTablessWorkbench(withMenu));
  return (
    <WorkbenchThemeProvider>
      <Box w="full" h="100dvh">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Page menu header",
  component: PageMenuHeaderStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PageMenuHeaderStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A tabless page keeps a minimal header that holds only the openers of its closed view menus. */
export const WithClosedViewMenu: Story = {
  args: { withMenu: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Board content")).toBeVisible();
    const header = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>('[data-workbench-page-menu-header="main"]');
      expect(element).toBeVisible();
      return element!;
    });
    await expect(within(header).queryAllByRole("tab")).toHaveLength(0);
    await expect(canvasElement.querySelector('[data-workbench-panel-header="main"]')).toBeNull();
    await expect(within(header).getByRole("button", { name: "Open Main right menu" })).toBeVisible();
  },
};

/** A tabless page without view menus has no Main header at all. */
export const WithoutViewMenus: Story = {
  args: { withMenu: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Board content")).toBeVisible();
    await expect(canvasElement.querySelector('[data-workbench-page-menu-header="main"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-workbench-panel-header="main"]')).toBeNull();
  },
};

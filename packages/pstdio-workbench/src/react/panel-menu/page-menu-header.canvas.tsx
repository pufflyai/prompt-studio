import { Box, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { Workbench, WorkbenchThemeProvider } from "../index";

const createTablessWorkbench = (withMenu: boolean) => {
  const page = { extensionId: "preview", kind: "page" as const, id: "board" };
  const workbench = createWorkbench({ defaultPage: page });
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
    main: {
      kind: "view",
      presentation: "page",
      view: { kind: "view", id: "board" },
      cardinality: "one",
      tab: { getSnapshot: () => ({ label: "Current board" }) },
    },
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
  title: "Product/Workbench/Panels/Main page header",
  component: PageMenuHeaderStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof PageMenuHeaderStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
/** One Main header holds the breadcrumb, resource actions and view-menu controls. */
export const WithClosedViewMenu: Story = {
  id: "pstdio-workbench-reference-core-api-page-menu-header--with-closed-view-menu",
  args: { withMenu: true },
};
/** A page without view menus keeps its breadcrumb and navigation in the same Main header. */
export const WithoutViewMenus: Story = {
  id: "pstdio-workbench-reference-core-api-page-menu-header--without-view-menus",
  args: { withMenu: false },
};

import { Box, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { Workbench, WorkbenchThemeProvider } from "../index";

interface MenuWorkbenchOptions {
  closed?: readonly ("left" | "right")[];
  both?: boolean;
  menuMinPx?: number;
  tall?: boolean;
  embedded?: boolean;
}
const createMenuWorkbench = (options: MenuWorkbenchOptions) => {
  const page = { extensionId: "preview", kind: "page" as const, id: "menus" };
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
        render: () =>
          options.embedded ? (
            <Box h="full" display="flex" minH="0">
              <iframe title="Embedded controls" srcDoc="<button>Copy Link</button>" width="100%" height="100%" />
            </Box>
          ) : (
            <Box p="sm">
              {(options.tall ? Array.from({ length: 80 }, (_, line) => line) : [0]).map((line) => (
                <Text key={line}>Inspector details</Text>
              ))}
            </Box>
          ),
      },
    });
    workbench.viewMenus.registerViewMenu({
      id: side,
      ownerViewId: "document",
      viewId: side,
      side,
      regionSize: options.menuMinPx ? { minPx: options.menuMinPx, maxPx: 320 } : undefined,
    });
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
  fullscreen: true,
} satisfies CanvasMeta<typeof PanelMenuStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const ReopenAttached: Story = {
  id: "pstdio-workbench-reference-core-api-panel-menus--reopen-attached",
  args: { width: 700, menus: { closed: ["right"] } },
};
export const FloatingWhenNarrow: Story = {
  id: "pstdio-workbench-reference-core-api-panel-menus--floating-when-narrow",
  args: { width: 500, menus: { closed: ["right"] } },
};
export const FloatingEmbeddedContent: Story = {
  id: "pstdio-workbench-reference-core-api-panel-menus--floating-embedded-content",
  args: { width: 500, menus: { closed: ["right"], embedded: true } },
};
export const FloatingTallContent: Story = {
  id: "pstdio-workbench-reference-core-api-panel-menus--floating-tall-content",
  args: { width: 500, menus: { closed: ["right"], tall: true } },
};
export const BothMenusAttached: Story = {
  id: "pstdio-workbench-reference-core-api-panel-menus--both-menus-attached",
  args: { width: 700, menus: { both: true } },
};
export const OneMenuFits: Story = {
  id: "pstdio-workbench-reference-core-api-panel-menus--one-menu-fits",
  args: { width: 650, menus: { both: true, menuMinPx: 300 } },
};
export const FloatingPeekKeepsAttachedMenu: Story = {
  id: "pstdio-workbench-reference-core-api-panel-menus--floating-peek-keeps-attached-menu",
  args: { width: 650, menus: { both: true, closed: ["left"], menuMinPx: 300 } },
};
export const FloatingPeekKeepsOpenPreference: Story = {
  id: "pstdio-workbench-reference-core-api-panel-menus--floating-peek-keeps-open-preference",
  args: { width: 240, menus: {} },
};

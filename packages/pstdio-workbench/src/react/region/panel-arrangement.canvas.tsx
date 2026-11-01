import { Box, Button, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Activity, useState } from "react";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createWorkbenchTerminalModule } from "../terminal/terminal-module";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { createArrangementWorkbench } from "./panel-arrangement-workbench";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel arrangement",
  component: WorkbenchStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const HeaderlessMain: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--headerless-main",
  args: { workbench: createArrangementWorkbench() },
};
const headerlessWebview = (
  <Box asChild h="full" minH="full" w="full">
    <iframe
      title="Headerless webview"
      sandbox="allow-scripts"
      srcDoc={`<!doctype html><html
            ondragover="event.preventDefault()"
            ondrop="event.preventDefault(); document.querySelector('output').textContent = event.dataTransfer.files[0]?.name">
          <body><h1>Headerless webview</h1>
            <input aria-label="Webview draft" placeholder="Edit this draft before dragging a tab">
            <p>Drop a file anywhere in this webview.</p>
            <output aria-label="Dropped file"></output>
          </body></html>`}
    />
  </Box>
);
export const HeaderlessWebview: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--headerless-webview",
  args: { workbench: createArrangementWorkbench(false, headerlessWebview) },
};
export const DisallowedWebviewDestination: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--disallowed-webview-destination",
  ...HeaderlessWebview,
  args: { workbench: createArrangementWorkbench(false, headerlessWebview, false) },
};
export const Crowded: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--crowded",
  args: { workbench: createArrangementWorkbench(true) },
};
const secondaryWorkbench = createArrangementWorkbench();
const secondarySession = secondaryWorkbench.layout
  .getLayout()
  .regions.side.widgets.find((widget) => widget.tabRetention === "preview")!;
secondaryWorkbench.movePanel(secondarySession.widgetId, "secondary");
export const SecondarySession: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--secondary-session",
  args: { workbench: secondaryWorkbench },
};
const shortDestination = createArrangementWorkbench();
const shortTab = shortDestination.layout.getLayout().regions.side.widgets[0]!;
shortDestination.movePanel(shortTab.widgetId, "secondary");
shortDestination.layout.updateWidgetPlacement(shortTab.widgetId, {
  title: "T",
  resource: { ...shortTab.resource!, label: "T" },
});
export const ShortDestinationTab: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--short-destination-tab",
  args: { workbench: shortDestination },
};
const movedPageWorkbench = createArrangementWorkbench();
for (const session of movedPageWorkbench.layout.getLayout().regions.side.widgets)
  movedPageWorkbench.closePlacement(session.placementIdentity!);
movedPageWorkbench.movePanel(movedPageWorkbench.layout.getLayout().regions.main.widgets[0]!.widgetId, "side");
export const MovedSingleView: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--moved-single-view",
  args: { workbench: movedPageWorkbench },
};
const floatingWorkbench = createArrangementWorkbench();
floatingWorkbench.sidePanel.setMode("floating");
export const DetachedSide: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--detached-side",
  args: { workbench: floatingWorkbench },
};
const terminalWorkbench = createArrangementWorkbench();
terminalWorkbench.registerModule(createWorkbenchTerminalModule());
terminalWorkbench.shellPlacements.openPlacement({
  placementId: "workbench.terminal",
  resource: { type: "terminal", id: "restored-terminal", label: "Restored terminal" },
  title: "Restored terminal",
  open: "pin",
});
terminalWorkbench.shell.setRegionOpen("secondary", true);
export const TerminalIcons: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--terminal-icons",
  args: { workbench: terminalWorkbench },
};
const previewInsertionWorkbench = createArrangementWorkbench();
const draggedPreview = previewInsertionWorkbench.layout
  .getLayout()
  .regions.side.widgets.find((widget) => widget.tabRetention === "preview")!;
previewInsertionWorkbench.movePanel(draggedPreview.widgetId, "secondary");
void previewInsertionWorkbench.navigation.openTarget({
  kind: "panel",
  panel: { kind: "placement", extensionId: "preview", id: "sessions" },
  resource: { type: "session", id: "kept-preview", label: "Unpinned session to keep" },
  open: "preview",
});
export const PreviewInsertion: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--preview-insertion",
  args: { workbench: previewInsertionWorkbench },
};
const neverOpenedBottom = createArrangementWorkbench(false, undefined, undefined, false);
export const ClosedBottom: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--closed-bottom",
  args: { workbench: neverOpenedBottom },
};
const closedSide = createArrangementWorkbench(false, undefined, undefined, false, "main");
closedSide.shell.setHeaderVisible("main", true);
export const ClosedSide: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--closed-side",
  args: { workbench: closedSide },
};
const closedReversed = createArrangementWorkbench(false, undefined, undefined, false, "main");
closedReversed.shell.setHeaderVisible("main", true);
closedReversed.shell.repositionPanel("side", "left");
closedReversed.shell.repositionPanel("secondary", "top");
export const ClosedReversed: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--closed-reversed",
  args: { workbench: closedReversed },
};
const positioned = createArrangementWorkbench();
positioned.shell.repositionPanel("side", "left");
positioned.shell.repositionPanel("secondary", "top");
export const Repositioned: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--repositioned",
  args: { workbench: positioned },
};
const closedLeftSide = createArrangementWorkbench(false, undefined, undefined, false, "main");
closedLeftSide.shell.setHeaderVisible("main", true);
closedLeftSide.shell.repositionPanel("side", "left");
export const ClosedLeftSide: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--closed-left-side",
  args: { workbench: closedLeftSide },
};
const closedTopBottom = createArrangementWorkbench(false, undefined, undefined, false);
closedTopBottom.shell.repositionPanel("secondary", "top");
export const ClosedTopBottom: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--closed-top-bottom",
  args: { workbench: closedTopBottom },
};
const createLastTabWorkbench = (region: "side" | "secondary", movable = true) => {
  // Keep a live unpinned editor as the only tab, so its drag can move the panel.
  const workbench = createArrangementWorkbench(false, undefined, undefined, false, region);
  const pinned = workbench.layout
    .getLayout()
    .regions[region].widgets.find((widget) => widget.tabRetention === "persistent")!;
  workbench.closePlacement(pinned.placementIdentity!);
  workbench.modes.getMode("arrangement")!.regionSettings![region] = { movable };
  return workbench;
};
export const LastSideTab: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--last-side-tab",
  args: { workbench: createLastTabWorkbench("side") },
};
export const LastBottomTab: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--last-bottom-tab",
  args: { workbench: createLastTabWorkbench("secondary") },
};
export const FixedLastSideTab: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--fixed-last-side-tab",
  args: { workbench: createLastTabWorkbench("side", false) },
};
export const FixedLastBottomTab: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--fixed-last-bottom-tab",
  args: { workbench: createLastTabWorkbench("secondary", false) },
};
export const BottomTabs: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--bottom-tabs",
  args: { workbench: createArrangementWorkbench(false, undefined, undefined, false, "secondary") },
};
const SessionSwitchWorkbench = (props: { workbench: ReturnType<typeof createArrangementWorkbench> }) => {
  const { workbench } = props;
  const [open, setOpen] = useState(true);
  const [visible, setVisible] = useState(true);
  return (
    <WorkbenchThemeProvider>
      <Button onClick={() => setOpen(false)}>Close example workbench</Button>
      <Button onClick={() => setVisible(!visible)}>{visible ? "Hide workbench" : "Show workbench"}</Button>
      {open ? (
        <Activity mode={visible ? "visible" : "hidden"}>
          <WorkbenchStory workbench={workbench} />
        </Activity>
      ) : (
        <Text>Workbench closed</Text>
      )}
    </WorkbenchThemeProvider>
  );
};
export const SessionSwitchKeepsMainView: Story = {
  id: "pstdio-workbench-reference-core-api-panel-arrangement--session-switch-keeps-main-view",
  args: {
    workbench: createArrangementWorkbench(
      false,
      <Box asChild h="full" w="full">
        <iframe title="Retained Timeline" srcDoc='<input aria-label="Unsaved Timeline draft">' />
      </Box>,
    ),
  },
  render: (args) => <SessionSwitchWorkbench workbench={args.workbench} />,
};

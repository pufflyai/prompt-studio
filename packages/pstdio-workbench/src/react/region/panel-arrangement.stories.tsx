import { Box, Button, Input, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Activity, type ReactNode, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench, type WorkbenchPanelRegion } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createWorkbenchTerminalModule } from "../terminal/terminal-module";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";

export const createArrangementWorkbench = (
  crowded = false,
  pageContent: ReactNode = <Text p="md">Page without a header</Text>,
  presentation: "tabs" | "page" = "tabs",
  bottomInitiallyOpen = true,
  sourceRegion: WorkbenchPanelRegion = "side",
) => {
  const page = { kind: "page", extensionId: "storybook", id: "arrangement" } as const;
  const w = createWorkbench({
    startPage: page,
    initialSidePanelMode: sourceRegion === "side" ? "attached" : "closed",
    defaultPanelOpenByRegionId: { secondary: bottomInitiallyOpen },
  });
  w.modes.registerMode({
    id: "arrangement",
    label: "Arrange tabs",
    regionSettings: { main: { showHeader: false } },
    activate() {},
  });
  w.views.registerView({
    id: "page",
    title: "Page",
    body: { kind: "react", render: () => pageContent },
  });
  w.views.registerView({
    id: "editor",
    title: "Session",
    icon: "MessageCircle",
    body: {
      kind: "react",
      render: (input) => (
        <Box p="md">
          <Text>{input.instance.resource?.label}</Text>
          <Input aria-label="Retained draft" placeholder="Type here, then move this tab" />
        </Box>
      ),
    },
  });
  w.views.registerView({
    id: "menu",
    title: "Tools",
    body: { kind: "react", render: () => <Text p="md">Panel menu</Text> },
  });
  w.viewMenus.registerViewMenu({ id: "tools", ownerViewId: "editor", viewId: "menu", side: "right" });
  w.pages.registerPage({
    id: page.id,
    ref: page,
    path: "arrangement",
    modeId: "arrangement",
    main: { kind: "view", view: { kind: "view", id: "page" }, cardinality: "one", presentation },
    slots: [],
  });
  w.commands.registerCommand(
    { id: "add-session", label: "New session" },
    {
      execute: (_args, context) =>
        w.navigation.openTarget({
          kind: "panel",
          panel: { kind: "placement", extensionId: "storybook", id: "sessions" },
          resource: { type: "session", id: crypto.randomUUID(), label: "New session" },
          open: "pin",
          region: context?.region,
        }),
    },
  );
  w.modePlacements.registerPlacement({
    id: "sessions",
    ref: { kind: "placement", extensionId: "storybook", id: "sessions" },
    modeId: "arrangement",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "session" }],
        view: { kind: "view", id: "editor" },
        cardinality: "many",
        add: { kind: "command", target: { command: { kind: "command", extensionId: "storybook", id: "add-session" } } },
      },
    },
    tab: {
      getSnapshot: (instance) => ({
        label: instance.resource?.label,
        menu: [
          {
            id: "session-actions",
            rows: [
              {
                id: "new",
                label: "New session",
                icon: "MessageSquarePlus",
                action: { kind: "command", commandId: "add-session" },
              },
            ],
          },
        ],
      }),
    },
  });
  // Command references use the declared owner; this alias keeps the example's action identical to an extension action.
  w.commands.registerCommand(
    { id: "storybook.command.add-session", label: "Create session" },
    { execute: (args, context) => w.commands.executeCommand("add-session", args, context) },
  );
  w.pageLocations.switchProject("arrangement");
  for (let i = 0; i < (crowded ? 8 : 2); i++)
    void w.navigation.openTarget({
      kind: "panel",
      panel: { kind: "placement", extensionId: "storybook", id: "sessions" },
      resource: {
        type: "session",
        id: String(i),
        label: i === 0 ? "Review session" : `Session with a longer name ${i}`,
      },
      region: sourceRegion,
      open: i === (crowded ? 7 : 1) ? "preview" : "pin",
    });
  return w;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel arrangement",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HeaderlessMain: Story = { args: { workbench: createArrangementWorkbench() } };
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
  args: { workbench: createArrangementWorkbench(false, headerlessWebview) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('iframe[title="Headerless webview"]')).toBeVisible();
    await expect(canvasElement.querySelector('[data-workbench-panel-header="main"]')).not.toBeVisible();
    await expect(canvasElement.querySelector('[data-workbench-tab-drop="main"]')).not.toBeVisible();
  },
};
export const DisallowedWebviewDestination: Story = {
  ...HeaderlessWebview,
  args: { workbench: createArrangementWorkbench(false, headerlessWebview, "page") },
};
export const Crowded: Story = { args: { workbench: createArrangementWorkbench(true) } };
const secondaryWorkbench = createArrangementWorkbench();
const secondarySession = secondaryWorkbench.layout
  .getLayout()
  .regions.side.widgets.find((widget) => widget.tabRetention === "preview")!;
secondaryWorkbench.movePanel(secondarySession.widgetId, "secondary");
export const SecondarySession: Story = { args: { workbench: secondaryWorkbench } };
const shortDestination = createArrangementWorkbench();
const shortTab = shortDestination.layout.getLayout().regions.side.widgets[0]!;
shortDestination.movePanel(shortTab.widgetId, "secondary");
shortDestination.layout.updateWidgetPlacement(shortTab.widgetId, {
  title: "T",
  resource: { ...shortTab.resource!, label: "T" },
});
export const ShortDestinationTab: Story = { args: { workbench: shortDestination } };
const movedPageWorkbench = createArrangementWorkbench();
for (const session of movedPageWorkbench.layout.getLayout().regions.side.widgets)
  movedPageWorkbench.closePlacement(session.placementIdentity!);
movedPageWorkbench.movePanel(movedPageWorkbench.layout.getLayout().regions.main.widgets[0]!.widgetId, "side");
export const MovedSingleView: Story = { args: { workbench: movedPageWorkbench } };
const floatingWorkbench = createArrangementWorkbench();
floatingWorkbench.sidePanel.setMode("floating");
export const DetachedSide: Story = { args: { workbench: floatingWorkbench } };
const terminalWorkbench = createArrangementWorkbench();
terminalWorkbench.registerModule(createWorkbenchTerminalModule());
terminalWorkbench.shellPlacements.openPlacement({
  placementId: "workbench.terminal",
  resource: { type: "terminal", id: "restored-terminal", label: "Restored terminal" },
  title: "Restored terminal",
  open: "pin",
});
terminalWorkbench.shell.setRegionOpen("secondary", true);
export const TerminalIcons: Story = { args: { workbench: terminalWorkbench } };

const previewInsertionWorkbench = createArrangementWorkbench();
const draggedPreview = previewInsertionWorkbench.layout
  .getLayout()
  .regions.side.widgets.find((widget) => widget.tabRetention === "preview")!;
previewInsertionWorkbench.movePanel(draggedPreview.widgetId, "secondary");
void previewInsertionWorkbench.navigation.openTarget({
  kind: "panel",
  panel: { kind: "placement", extensionId: "storybook", id: "sessions" },
  resource: { type: "session", id: "kept-preview", label: "Unpinned session to keep" },
  open: "preview",
});
export const PreviewInsertion: Story = { args: { workbench: previewInsertionWorkbench } };

const neverOpenedBottom = createArrangementWorkbench(false, undefined, undefined, false);
export const ClosedBottom: Story = { args: { workbench: neverOpenedBottom } };
const closedSide = createArrangementWorkbench(false, undefined, undefined, false, "main");
closedSide.shell.setHeaderVisible("main", true);
export const ClosedSide: Story = { args: { workbench: closedSide } };
const closedReversed = createArrangementWorkbench(false, undefined, undefined, false, "main");
closedReversed.shell.setHeaderVisible("main", true);
closedReversed.shell.repositionPanel("side", "left");
closedReversed.shell.repositionPanel("secondary", "top");
export const ClosedReversed: Story = { args: { workbench: closedReversed } };
const positioned = createArrangementWorkbench();
positioned.shell.repositionPanel("side", "left");
positioned.shell.repositionPanel("secondary", "top");
export const Repositioned: Story = { args: { workbench: positioned } };
const closedLeftSide = createArrangementWorkbench(false, undefined, undefined, false, "main");
closedLeftSide.shell.setHeaderVisible("main", true);
closedLeftSide.shell.repositionPanel("side", "left");
export const ClosedLeftSide: Story = { args: { workbench: closedLeftSide } };
const closedTopBottom = createArrangementWorkbench(false, undefined, undefined, false);
closedTopBottom.shell.repositionPanel("secondary", "top");
export const ClosedTopBottom: Story = { args: { workbench: closedTopBottom } };

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
export const LastSideTab: Story = { args: { workbench: createLastTabWorkbench("side") } };
export const LastBottomTab: Story = { args: { workbench: createLastTabWorkbench("secondary") } };
export const FixedLastSideTab: Story = { args: { workbench: createLastTabWorkbench("side", false) } };
export const FixedLastBottomTab: Story = { args: { workbench: createLastTabWorkbench("secondary", false) } };
export const BottomTabs: Story = {
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
  args: {
    workbench: createArrangementWorkbench(
      false,
      <Box asChild h="full" w="full">
        <iframe title="Retained Timeline" srcDoc='<input aria-label="Unsaved Timeline draft">' />
      </Box>,
    ),
  },
  render: (args) => <SessionSwitchWorkbench workbench={args.workbench} />,
  play: async ({ canvasElement, args }) => {
    await waitFor(() =>
      expect(
        canvasElement
          .querySelector<HTMLIFrameElement>('iframe[title="Retained Timeline"]')
          ?.contentDocument?.querySelector("input"),
      ).toBeTruthy(),
    );
    const iframe = canvasElement.querySelector<HTMLIFrameElement>('iframe[title="Retained Timeline"]')!;
    const document = iframe.contentDocument!;
    const input = document.querySelector("input")!;
    const host = iframe.closest("[data-workbench-instance]")!.parentElement!;
    await userEvent.type(input, "Keep this unsaved draft");
    for (const id of ["first-preview", "second-preview", "first-preview"]) {
      await args.workbench.navigation.openTarget({
        kind: "panel",
        panel: { kind: "placement", extensionId: "storybook", id: "sessions" },
        resource: { type: "session", id, label: id },
        open: "preview",
      });
      await waitFor(() => expect(within(canvasElement).getAllByText(id, { exact: true })[0]).toBeVisible());
      await expect(iframe.contentDocument).toBe(document);
      await expect(input.value).toBe("Keep this unsaved draft");
    }
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Hide workbench" }));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Show workbench" }));
    await waitFor(() => expect(iframe).toBeVisible());
    await expect(iframe.contentDocument).toBe(document);
    await expect(input.value).toBe("Keep this unsaved draft");
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Close example workbench" }));
    await waitFor(() => expect(host.isConnected).toBe(false));
    await expect(host.hasChildNodes()).toBe(false);
  },
};

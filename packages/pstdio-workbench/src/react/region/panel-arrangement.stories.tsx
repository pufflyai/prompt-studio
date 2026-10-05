import { Box, Input, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createWorkbenchTerminalModule } from "../terminal/terminal-module";

export const createArrangementWorkbench = (crowded = false) => {
  const page = { kind: "page", extensionId: "storybook", id: "arrangement" } as const;
  const w = createWorkbench({
    startPage: page,
    initialSidePanelMode: "attached",
    defaultPanelOpenByRegionId: { secondary: true },
  });
  w.modes.registerMode({ id: "arrangement", label: "Arrange tabs", activate() {} });
  w.views.registerView({
    id: "page",
    title: "Page",
    body: { kind: "react", render: () => <Text p="md">Page without a header</Text> },
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
    main: { kind: "view", view: { kind: "view", id: "page" }, cardinality: "one" },
    slots: [],
  });
  w.commands.registerCommand(
    { id: "add-session", label: "New session" },
    {
      execute: () =>
        w.navigation.openTarget({
          kind: "panel",
          panel: { kind: "placement", extensionId: "storybook", id: "sessions" },
          resource: { type: "session", id: crypto.randomUUID(), label: "New session" },
          open: "pin",
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
                icon: "PenBox",
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
    { execute: () => w.commands.executeCommand("add-session") },
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
export const Crowded: Story = { args: { workbench: createArrangementWorkbench(true) } };
const secondaryWorkbench = createArrangementWorkbench();
const secondarySession = secondaryWorkbench.layout.getLayout().regions.side.widgets.at(-1)!;
secondaryWorkbench.movePanel(secondarySession.widgetId, "secondary");
export const SecondarySession: Story = { args: { workbench: secondaryWorkbench } };
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

import { Box, Input, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { createWorkbench, type WorkbenchPanelRegion } from "../../core";

export const createArrangementWorkbench = (
  crowded = false,
  pageContent: ReactNode = <Text p="md">Page without a header</Text>,
  mainAcceptsTabs = true,
  bottomInitiallyOpen = true,
  sourceRegion: WorkbenchPanelRegion = "side",
) => {
  const page = { kind: "page", extensionId: "preview", id: "arrangement" } as const;
  const w = createWorkbench({
    startPage: page,
    initialSidePanelMode: sourceRegion === "side" ? "attached" : "closed",
    defaultPanelOpenByRegionId: { secondary: bottomInitiallyOpen },
  });
  w.modes.registerMode({
    id: "arrangement",
    label: "Arrange tabs",
    regionSettings: { main: { showHeader: false, acceptsTabs: mainAcceptsTabs } },
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
    main: { kind: "view", view: { kind: "view", id: "page" }, cardinality: "one" },
    slots: [],
  });
  w.commands.registerCommand(
    { id: "add-session", label: "New session" },
    {
      execute: (_args, context) =>
        w.navigation.openTarget({
          kind: "panel",
          panel: { kind: "placement", extensionId: "preview", id: "sessions" },
          resource: { type: "session", id: crypto.randomUUID(), label: "New session" },
          open: "pin",
          region: context?.region,
        }),
    },
  );
  w.modePlacements.registerPlacement({
    id: "sessions",
    ref: { kind: "placement", extensionId: "preview", id: "sessions" },
    modeId: "arrangement",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "session" }],
        view: { kind: "view", id: "editor" },
        cardinality: "many",
        add: { kind: "command", target: { command: { kind: "command", extensionId: "preview", id: "add-session" } } },
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
    { id: "preview.command.add-session", label: "Create session" },
    { execute: (args, context) => w.commands.executeCommand("add-session", args, context) },
  );
  w.pageLocations.switchProject("arrangement");
  for (let i = 0; i < (crowded ? 8 : 2); i++)
    void w.navigation.openTarget({
      kind: "panel",
      panel: { kind: "placement", extensionId: "preview", id: "sessions" },
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

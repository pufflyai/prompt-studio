import { Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { HostStorageProvider } from "@pstdio/ui";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const page = (id: string) => ({ kind: "page" as const, extensionId: "preview", id });
const panel = { kind: "placement" as const, extensionId: "preview", id: "session" };
const session = { type: "session", id: "review", extensionId: "preview", label: "Review session" };
const SessionNavigation = () => {
  const [fixture] = useState(() => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const w = createWorkbench({ startPage: page("sessions"), initialSidePanelMode: "attached" });
    w.modes.registerMode({ id: "project", chrome: { sidenav: "navigation" }, activate() {} });
    w.views.registerView({
      id: "session",
      title: "Session",
      body: {
        kind: "react",
        render: (input) => (
          <Text p="md" data-testid="session-content">
            {input.instance.resource?.label ?? "Choose a session"}
          </Text>
        ),
      },
    });
    w.views.registerView({
      id: "notes",
      title: "Notes",
      body: {
        kind: "react",
        render: () => <LazyMarkdownEditor isEditable defaultState="Select these words to show the editor toolbar." />,
      },
    });
    w.modePlacements.registerPlacement({
      id: "session",
      ref: panel,
      modeId: "project",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", extensionId: "preview", id: "session" }],
          view: { kind: "view", id: "session" },
          cardinality: "many",
        },
      },
    });
    w.pages.registerPage({
      id: "home",
      ref: page("home"),
      path: "",
      modeId: "project",
      main: { kind: "panels" },
      slots: [],
    });
    w.views.registerView({
      id: "tickets",
      title: "Tickets",
      body: { kind: "react", render: () => <Text p="md">Ticket collection</Text> },
    });
    for (const id of ["sessions", "notes", "tickets"])
      w.pages.registerPage({
        id,
        ref: page(id),
        title: id,
        path: id,
        modeId: "project",
        parentId: "home",
        ...(id === "sessions"
          ? {
              panelView: panel,
              resource: { kinds: [{ kind: "resource-kind" as const, extensionId: "preview", id: "session" }] },
            }
          : {}),
        main: {
          kind: "view",
          view: { kind: "view", id: id === "sessions" ? "session" : id },
          cardinality: "one",
          presentation: "page",
          empty: { kind: "view", id: "session" },
        },
        slots: [],
      });
    w.commands.registerCommand(
      { id: "new-session", label: "New session" },
      {
        execute: () =>
          w.navigation.openPage({ page: page("sessions"), resource: { ...session, id: "new", label: "New session" } }),
      },
    );
    w.keybindings.registerKeybinding({
      id: "create-session",
      action: { kind: "command", commandId: "new-session", args: {} },
      layer: "create",
      keybinding: "S",
    });
    w.views.registerView({
      id: "navigation",
      title: "Navigation",
      body: {
        kind: "tree",
        canMove: ({ source, destination }) => source.moveScope === destination.moveScope,
        getHeader: () => [
          {
            id: "header",
            moveScope: "project",
            nodes: [
              {
                id: "sessions",
                label: "Sessions",
                canHide: true,
                target: { kind: "page", page: page("sessions"), resource: session },
                contextMenuActions: [{ id: "new", label: "New session", commandId: "new-session", args: {} }],
              },
              { id: "notes", label: "Notes", canHide: true, target: { kind: "page", page: page("notes") } },
              { id: "tickets", label: "Tickets", canHide: true, target: { kind: "page", page: page("tickets") } },
              {
                id: "linked-session",
                label: "Linked session",
                canHide: true,
                target: { kind: "panel", panel, resource: session },
              },
            ],
          },
        ],
        getBody: () => [],
        getChildren: () => [],
      },
    });
    w.pageLocations.setProject("session-navigation");
    w.pageLocations.navigate({ kind: "page", page: page("sessions") });
    void w.navigation.openPanel({ panel, resource: session, region: "side", open: "pin" });
    void w.navigation.openPanel({
      panel,
      resource: { ...session, id: "other", label: "Another session" },
      region: "side",
      open: "pin",
    });
    return { workbench: w, storage };
  });
  return (
    <HostStorageProvider storage={fixture.storage}>
      <WorkbenchStory workbench={fixture.workbench} />
    </HostStorageProvider>
  );
};
export default {
  title: "Product/Workbench/Navigation/Sessions and tabs",
  component: SessionNavigation,
  fullscreen: true,
} satisfies CanvasMeta;
export const Interactive: CanvasFrame = {};

import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../workbench-core";

const TICKET_KIND = "history.test.ticket";

const setupWorkbench = () => {
  const workbench = createWorkbenchCore();

  workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
  workbench.layout.registerWidget({
    id: "ticket-viewer",
    title: "Ticket",
    area: "main",
    closable: true,
    singleton: true,
    rendererId: "noop",
    resourceKinds: [TICKET_KIND],
  });
  workbench.layout.registerWidget({
    id: "scratch",
    title: "Scratch",
    area: "main",
    closable: true,
    singleton: false,
    reuse: "none",
    rendererId: "noop",
  });
  workbench.layout.registerWidget({
    id: "sidebar",
    title: "Sidebar",
    area: "left",
    rendererId: "noop",
  });

  workbench.resources.registerOpener({
    id: "ticket-opener",
    canOpen: (resource) => resource.kind === TICKET_KIND,
    open: (resource) => {
      workbench.layout.openWidget("ticket-viewer", { resource, title: resource.label ?? resource.uri });
    },
  });

  return workbench;
};

const openTicket = (workbench: ReturnType<typeof setupWorkbench>, id: string) =>
  workbench.resources.openResource({ kind: TICKET_KIND, uri: `${TICKET_KIND}:${id}`, id, label: `Ticket ${id}` });

describe("createHistoryController", () => {
  test("records every successful open with a stable cursor", async () => {
    const workbench = setupWorkbench();
    await openTicket(workbench, "PS-1");
    await openTicket(workbench, "PS-2");
    await openTicket(workbench, "PS-3");

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries.map((entry) => entry.resource?.id)).toEqual(["PS-1", "PS-2", "PS-3"]);
    expect(snapshot.cursor).toBe(snapshot.entries.length - 1);
  });

  test("goBack moves the cursor without recording a new entry", async () => {
    const workbench = setupWorkbench();
    await openTicket(workbench, "PS-1");
    await openTicket(workbench, "PS-2");
    await openTicket(workbench, "PS-3");

    const back = workbench.history.goBack();
    expect(back?.resource?.id).toBe("PS-2");
    const second = workbench.history.goBack();
    expect(second?.resource?.id).toBe("PS-1");

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries.map((entry) => entry.resource?.id)).toEqual(["PS-1", "PS-2", "PS-3"]);
    expect(snapshot.cursor).toBe(0);
  });

  test("goBack keeps async resource reopen silent until it settles", async () => {
    const workbench = createWorkbenchCore();
    const opened: string[] = [];

    workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
    workbench.layout.registerWidget({
      id: "ticket-viewer",
      title: "Ticket",
      area: "main",
      closable: true,
      singleton: true,
      rendererId: "noop",
      resourceKinds: [TICKET_KIND],
    });
    workbench.resources.registerOpener({
      id: "ticket-opener",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: async (resource) => {
        await Promise.resolve();
        opened.push(resource.uri);
        workbench.layout.openWidget("ticket-viewer", { resource, title: resource.label ?? resource.uri });
      },
    });

    await openTicket(workbench, "PS-1");
    await openTicket(workbench, "PS-2");
    await openTicket(workbench, "PS-3");

    const back = workbench.history.goBack();
    expect(back?.resource?.id).toBe("PS-2");
    await Promise.resolve();

    const snapshot = workbench.history.store.getState();
    expect(opened).toEqual([
      `${TICKET_KIND}:PS-1`,
      `${TICKET_KIND}:PS-2`,
      `${TICKET_KIND}:PS-3`,
      `${TICKET_KIND}:PS-2`,
    ]);
    expect(snapshot.entries.map((entry) => entry.resource?.id)).toEqual(["PS-1", "PS-2", "PS-3"]);
    expect(snapshot.cursor).toBe(1);
  });

  test("records successful resource opens that do not activate a layout placement", async () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
    workbench.resources.registerOpener({
      id: "metadata-opener",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: () => "opened",
    });

    await openTicket(workbench, "PS-1");

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries.map((entry) => entry.resource?.id)).toEqual(["PS-1"]);
    expect(snapshot.cursor).toBe(0);
  });

  test("opening after goBack truncates the forward history", async () => {
    const workbench = setupWorkbench();
    await openTicket(workbench, "PS-1");
    await openTicket(workbench, "PS-2");
    await openTicket(workbench, "PS-3");
    workbench.history.goBack();
    workbench.history.goBack();

    await openTicket(workbench, "PS-9");

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries.map((entry) => entry.resource?.id)).toEqual(["PS-1", "PS-9"]);
    expect(snapshot.cursor).toBe(1);
  });

  test("goBack and goForward replace the active placement when replaying closed resources", async () => {
    const workbench = createWorkbenchCore();
    const board = { kind: "history.test.board", uri: "history.test.board:tickets", label: "Tickets" };
    const ticket = { kind: TICKET_KIND, uri: `${TICKET_KIND}:PS-1`, id: "PS-1", label: "Ticket PS-1" };

    workbench.resources.registerKind({ kind: "history.test.board", label: "Board" });
    workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
    workbench.layout.registerWidget({
      id: "board-view",
      title: "Board",
      area: "main",
      singleton: true,
      rendererId: "noop",
    });
    workbench.layout.registerWidget({
      id: "ticket-editor",
      title: "Ticket",
      area: "main",
      singleton: true,
      rendererId: "noop",
    });
    workbench.resources.registerOpener({
      id: "board-opener",
      canOpen: (resource) => resource.kind === "history.test.board",
      open: (resource, input) =>
        workbench.layout.openWidget("board-view", {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    });
    workbench.resources.registerOpener({
      id: "ticket-editor-opener",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: (resource, input) =>
        workbench.layout.openWidget("ticket-editor", {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    });

    await workbench.resources.openResource(board);
    await workbench.resources.openResource(ticket, { replaceActive: true });

    expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
      "ticket-editor",
    ]);

    workbench.history.goBack();
    await Promise.resolve();

    expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
      "board-view",
    ]);
    // Replaying must not append entries — the primary stays a single placement and the
    // recorded history length is unchanged across both Back and Forward.
    expect(workbench.history.store.getState().entries.length).toBe(2);

    workbench.history.goForward();
    await Promise.resolve();

    expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
      "ticket-editor",
    ]);
    expect(workbench.history.store.getState().entries.length).toBe(2);
  });
});

describe("createHistoryController mode-aware navigation", () => {
  test("goBack restores the entry mode before reopening its resource", async () => {
    const workbench = createWorkbenchCore();

    workbench.resources.registerKind({ kind: "history.test.project-item", label: "Project item" });
    workbench.resources.registerKind({ kind: "history.test.workspace-file", label: "Workspace file" });

    workbench.modes.registerMode({
      id: "project",
      activate: (ctx) => {
        const widget = ctx.layout.registerWidget({
          id: "project-viewer",
          title: "Project",
          area: "main",
          singleton: true,
          rendererId: "noop",
          resourceKinds: ["history.test.project-item"],
        });
        const opener = ctx.resources.registerOpener({
          id: "project-opener",
          canOpen: (resource) => resource.kind === "history.test.project-item",
          open: (resource, input) =>
            ctx.layout.openWidget("project-viewer", {
              resource,
              title: resource.label,
              replaceActive: input.replaceActive,
            }),
        });
        return [widget, opener];
      },
    });
    workbench.modes.registerMode({
      id: "workspace",
      activate: (ctx) => {
        const widget = ctx.layout.registerWidget({
          id: "workspace-viewer",
          title: "Workspace",
          area: "main",
          singleton: true,
          rendererId: "noop",
          resourceKinds: ["history.test.workspace-file"],
        });
        const opener = ctx.resources.registerOpener({
          id: "workspace-opener",
          canOpen: (resource) => resource.kind === "history.test.workspace-file",
          open: (resource, input) =>
            ctx.layout.openWidget("workspace-viewer", {
              resource,
              title: resource.label,
              replaceActive: input.replaceActive,
            }),
        });
        return [widget, opener];
      },
    });

    workbench.modes.setActiveMode("project");
    await workbench.resources.openResource({
      kind: "history.test.project-item",
      uri: "history.test.project-item:PS-1",
      id: "PS-1",
      label: "Project item",
    });
    workbench.modes.setActiveMode("workspace");
    await workbench.resources.openResource({
      kind: "history.test.workspace-file",
      uri: "history.test.workspace-file:file-a",
      id: "file-a",
      label: "Workspace file",
    });

    const back = workbench.history.goBack();
    await Promise.resolve();

    expect(back?.resource?.id).toBe("PS-1");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceUri).toBe("history.test.project-item:PS-1");
  });

  test("records and replays mode-only navigation entries", () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "settings", label: "Settings", activate: () => undefined });

    workbench.modes.setActiveMode("project");
    workbench.modes.setActiveMode("settings");

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries.map((entry) => entry.modeId)).toEqual(["project", "settings"]);

    const back = workbench.history.goBack();
    expect(back?.kind).toBe("mode");
    expect(workbench.modes.getActiveModeId()).toBe("project");

    const forward = workbench.history.goForward();
    expect(forward?.kind).toBe("mode");
    expect(workbench.modes.getActiveModeId()).toBe("settings");
  });
});

describe("createHistoryController widget history", () => {
  test("goPrevious toggles between the current and most-recent-different entry", async () => {
    const workbench = setupWorkbench();
    await openTicket(workbench, "PS-1");
    await openTicket(workbench, "PS-2");
    await openTicket(workbench, "PS-3");

    const previous = workbench.history.goPrevious();
    expect(previous?.resource?.id).toBe("PS-2");
  });

  test("records and replays distinct non-singleton widget placements", () => {
    const workbench = setupWorkbench();
    const first = workbench.layout.openWidget("scratch");
    const second = workbench.layout.openWidget("scratch");

    expect(first.widgetId).not.toBe(second.widgetId);

    const back = workbench.history.goBack();

    expect(back?.widgetId).toBe(first.widgetId);
    expect(workbench.layout.getLayout().activeWidgetId).toBe(first.widgetId);
  });

  test("does not record activations outside the main area", async () => {
    const workbench = setupWorkbench();
    await openTicket(workbench, "PS-1");

    // Activating a left-area widget must not push a back/forward entry — history is
    // scoped to the main (primary) area's active placement.
    workbench.layout.openWidget("sidebar");

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries.map((entry) => entry.resource?.id ?? entry.widgetId)).toEqual(["PS-1"]);
  });

  test("does not record pinned chrome widgets", async () => {
    const workbench = setupWorkbench();

    workbench.layout.openWidget("sidebar", { pinned: true });
    await openTicket(workbench, "PS-1");
    workbench.layout.openWidget("sidebar", { pinned: true });

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries.map((entry) => entry.resource?.id ?? entry.widgetId)).toEqual(["PS-1"]);
  });

  test("closing a widget feeds recentlyClosed and reopenLastClosed restores it", async () => {
    const workbench = setupWorkbench();
    workbench.layout.openWidget("scratch");
    workbench.layout.openWidget("scratch");
    workbench.layout.closeWidget("scratch");

    const closed = workbench.history.recentlyClosed();
    expect(closed[closed.length - 1]?.widgetId).toBe("scratch");

    workbench.history.reopenLastClosed();
    expect(workbench.layout.getLayout().areas.main.widgets.map((p) => p.widgetId)).toContain("scratch");
  });

  test("history caps entries to maxEntries", async () => {
    const workbench = setupWorkbench();
    workbench.history.clear();

    // bypass default workbench cap by re-creating a controller with a small cap
    const tinyHistory = (await import("./history-controller")).createHistoryController({
      layout: workbench.layout,
      resources: workbench.resources,
      maxEntries: 3,
    });

    await openTicket(workbench, "A");
    await openTicket(workbench, "B");
    await openTicket(workbench, "C");
    await openTicket(workbench, "D");

    const snapshot = tinyHistory.store.getState();
    expect(snapshot.entries.length).toBe(3);
    expect(snapshot.entries.map((entry) => entry.resource?.id)).toEqual(["B", "C", "D"]);
  });

  test("clear empties the entries and recently-closed lists", async () => {
    const workbench = setupWorkbench();
    await openTicket(workbench, "PS-1");
    workbench.layout.openWidget("scratch");
    workbench.layout.closeWidget("scratch");
    workbench.history.clear();

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.cursor).toBe(-1);
    expect(snapshot.recentlyClosed).toEqual([]);
  });
});

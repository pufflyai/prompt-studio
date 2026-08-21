import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../workbench-core";

const TICKET_KIND = "history.test.ticket";

const setupWorkbench = () => {
  const workbench = createWorkbenchCore();

  workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
  workbench.layout.registerWidget({
    id: "ticket-viewer",
    title: "Ticket",
    region: "main",
    closable: true,
    singleton: true,
    rendererId: "noop",
    resourceKinds: [TICKET_KIND],
  });
  workbench.layout.registerWidget({
    id: "scratch",
    title: "Scratch",
    region: "main",
    closable: true,
    singleton: false,
    reuse: "none",
    rendererId: "noop",
  });
  workbench.layout.registerWidget({
    id: "sidenav",
    title: "Sidenav",
    region: "sidenav",
    rendererId: "noop",
  });

  workbench.resources.registerPresenter({
    id: "ticket-presenter",
    canOpen: (resource) => resource.kind === TICKET_KIND,
    open: (resource) =>
      workbench.layout.openPanel("ticket-viewer", { resource, title: resource.label ?? resource.uri }),
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
});

describe("createHistoryController resource transactions", () => {
  test("commits synchronous resource opens before their returned promises settle", () => {
    const workbench = setupWorkbench();

    void openTicket(workbench, "PS-1");
    void openTicket(workbench, "PS-2");

    expect(workbench.history.store.getState().entries.map((entry) => entry.resource?.id)).toEqual(["PS-1", "PS-2"]);
  });

  test("records companion panels opened with a resource as one navigation step", async () => {
    const workbench = createWorkbenchCore();
    const ticket = { kind: "history.test.ticket", uri: "history.test.ticket:one", id: "one", label: "Ticket" };
    const workspace = {
      kind: "history.test.workspace",
      uri: "history.test.workspace:one",
      id: "workspace-one",
      label: "Workspace",
    };

    workbench.resources.registerKind({ kind: ticket.kind, label: "Ticket" });
    workbench.resources.registerKind({ kind: workspace.kind, label: "Workspace" });
    workbench.layout.registerLocation({
      id: "history.test.ticket-location",
      title: "Ticket",
      region: "main",
      rendererId: "noop",
      resourceKinds: [ticket.kind],
    });
    workbench.layout.registerLocation({
      id: "history.test.workspace-location",
      title: "Workspace",
      region: "main",
      rendererId: "noop",
      resourceKinds: [workspace.kind],
    });
    workbench.layout.registerSubPanel({
      id: "history.test.workspace-companion",
      title: "Workspace companion",
      region: "secondary",
      rendererId: "noop",
      resourceKinds: [workspace.kind],
    });
    workbench.resources.registerPresenter({
      id: "history.test.ticket-presenter",
      canOpen: (resource) => resource.kind === ticket.kind,
      open: (resource) => workbench.layout.openPanel("history.test.ticket-location", { resource }),
    });
    workbench.resources.registerPresenter({
      id: "history.test.workspace-presenter",
      canOpen: (resource) => resource.kind === workspace.kind,
      open: (resource) => {
        const location = workbench.layout.openPanel("history.test.workspace-location", { resource });
        workbench.layout.openPanel("history.test.workspace-companion", { resource });
        return location;
      },
    });

    await workbench.resources.openResource(ticket);
    await workbench.resources.openResource(workspace);

    expect(workbench.history.store.getState().entries.map((entry) => entry.resource?.uri)).toEqual([
      ticket.uri,
      workspace.uri,
    ]);
    expect(workbench.history.goBack()?.resource?.uri).toBe(ticket.uri);
  });

  test("records overlapping asynchronous opens in completion order", async () => {
    const workbench = createWorkbenchCore();
    const completions = new Map<string, () => void>();

    workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
    workbench.layout.registerLocation({
      id: "async-ticket-viewer",
      title: "Ticket",
      region: "main",
      rendererId: "noop",
      resourceKinds: [TICKET_KIND],
    });
    workbench.resources.registerPresenter({
      id: "async-ticket-presenter",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: (resource) =>
        new Promise<ReturnType<typeof workbench.layout.openPanel>>((resolve) => {
          completions.set(resource.id!, () => {
            resolve(workbench.layout.openPanel("async-ticket-viewer", { resource, title: resource.label }));
          });
        }),
    });

    const first = openTicket(workbench, "PS-1");
    const second = openTicket(workbench, "PS-2");

    completions.get("PS-1")?.();
    await first;
    expect(workbench.history.store.getState().entries.map((entry) => entry.resource?.id)).toEqual(["PS-1"]);

    completions.get("PS-2")?.();
    await second;
    expect(workbench.history.store.getState().entries.map((entry) => entry.resource?.id)).toEqual(["PS-1", "PS-2"]);
    expect(workbench.history.goBack()?.resource?.id).toBe("PS-1");
  });
});

describe("createHistoryController navigation", () => {
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
      region: "main",
      closable: true,
      singleton: true,
      rendererId: "noop",
      resourceKinds: [TICKET_KIND],
    });
    workbench.resources.registerPresenter({
      id: "ticket-presenter",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: async (resource) => {
        await Promise.resolve();
        opened.push(resource.uri);
        return workbench.layout.openPanel("ticket-viewer", {
          resource,
          title: resource.label ?? resource.uri,
        });
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

  test("replays a replaced Location through Back and Forward without growing the tab set", async () => {
    const workbench = createWorkbenchCore();
    const board = { kind: "history.test.board", uri: "history.test.board:tickets", label: "Tickets" };
    const ticket = { kind: TICKET_KIND, uri: `${TICKET_KIND}:PS-1`, id: "PS-1", label: "Ticket PS-1" };

    workbench.resources.registerKind({ kind: "history.test.board", label: "Board" });
    workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
    workbench.layout.registerWidget({
      id: "board-view",
      title: "Board",
      region: "main",
      singleton: true,
      rendererId: "noop",
    });
    workbench.layout.registerWidget({
      id: "ticket-editor",
      title: "Ticket",
      region: "main",
      singleton: true,
      rendererId: "noop",
    });
    workbench.resources.registerPresenter({
      id: "board-presenter",
      canOpen: (resource) => resource.kind === "history.test.board",
      open: (resource, input) =>
        workbench.layout.openPanel("board-view", {
          resource,
          title: resource.label,
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
        }),
    });
    workbench.resources.registerPresenter({
      id: "ticket-editor-presenter",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: (resource, input) =>
        workbench.layout.openPanel("ticket-editor", {
          resource,
          title: resource.label,
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
        }),
    });

    await workbench.resources.openResource(board);
    await workbench.resources.openResource(ticket, { replaceActive: true });

    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      "ticket-editor",
    ]);

    expect(workbench.history.goBack()?.resource?.uri).toBe(board.uri);
    await Promise.resolve();
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      "board-view",
    ]);
    expect(workbench.history.goForward()?.resource?.uri).toBe(ticket.uri);
    await Promise.resolve();
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.contributionId)).toEqual([
      "ticket-editor",
    ]);
    expect(workbench.history.store.getState().entries.map((entry) => entry.resource?.uri)).toEqual([
      board.uri,
      ticket.uri,
    ]);
  });

  test("Back and Forward replay existing resource presenters without changing the tab set", async () => {
    const workbench = createWorkbenchCore();
    const opened: string[] = [];
    workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
    workbench.layout.registerWidget({
      id: "ticket-editor",
      title: "Ticket",
      region: "main",
      singleton: false,
      rendererId: "noop",
      resourceKinds: [TICKET_KIND],
    });
    workbench.resources.registerPresenter({
      id: "ticket-editor-presenter",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: (resource, input) => {
        opened.push(resource.uri);
        return workbench.layout.openPanel("ticket-editor", {
          resource,
          title: resource.label,
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
        });
      },
    });

    await workbench.resources.openResource({
      kind: TICKET_KIND,
      uri: `${TICKET_KIND}:PS-1`,
      id: "PS-1",
      label: "Ticket PS-1",
    });
    await workbench.resources.openResource({
      kind: TICKET_KIND,
      uri: `${TICKET_KIND}:PS-2`,
      id: "PS-2",
      label: "Ticket PS-2",
    });
    const widgetIds = workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.widgetId);

    expect(workbench.history.goBack()?.resource?.id).toBe("PS-1");
    await Promise.resolve();
    expect(workbench.layout.getLayout().activeResourceUri).toBe(`${TICKET_KIND}:PS-1`);
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.widgetId)).toEqual(widgetIds);

    expect(workbench.history.goForward()?.resource?.id).toBe("PS-2");
    await Promise.resolve();
    expect(workbench.layout.getLayout().activeResourceUri).toBe(`${TICKET_KIND}:PS-2`);
    expect(workbench.layout.getLayout().regions.main.widgets.map((widget) => widget.widgetId)).toEqual(widgetIds);
    expect(opened).toEqual([
      `${TICKET_KIND}:PS-1`,
      `${TICKET_KIND}:PS-2`,
      `${TICKET_KIND}:PS-1`,
      `${TICKET_KIND}:PS-2`,
    ]);
  });
});

describe("createHistoryController mode-aware navigation", () => {
  test("restores a resource after its mode layout was deactivated", async () => {
    const workbench = createWorkbenchCore();
    const projectItem = {
      kind: "history.test.project-item",
      uri: "history.test.project-item:PS-1",
      id: "PS-1",
      label: "Project item",
    };
    const workspaceFile = {
      kind: "history.test.workspace-file",
      uri: "history.test.workspace-file:file-a",
      id: "file-a",
      label: "Workspace file",
    };

    workbench.resources.registerKind({ kind: "history.test.project-item", label: "Project item" });
    workbench.resources.registerKind({ kind: "history.test.workspace-file", label: "Workspace file" });
    workbench.layout.registerWidget({
      id: "project-viewer",
      title: "Project",
      region: "main",
      singleton: true,
      rendererId: "noop",
      resourceKinds: ["history.test.project-item"],
    });
    workbench.layout.registerWidget({
      id: "workspace-viewer",
      title: "Workspace",
      region: "main",
      singleton: true,
      rendererId: "noop",
      resourceKinds: ["history.test.workspace-file"],
    });
    workbench.resources.registerPresenter({
      id: "project-presenter",
      canOpen: (resource) => resource.kind === "history.test.project-item",
      open: (resource, input) =>
        workbench.layout.openPanel("project-viewer", {
          resource,
          title: resource.label,
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
        }),
    });
    workbench.resources.registerPresenter({
      id: "workspace-presenter",
      canOpen: (resource) => resource.kind === "history.test.workspace-file",
      open: (resource, input) =>
        workbench.layout.openPanel("workspace-viewer", {
          resource,
          title: resource.label,
          strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
        }),
    });
    workbench.modes.registerMode({
      id: "project",
      activate: () => undefined,
      seed: (ctx) => {
        ctx.layout.clearRegion("main");
      },
    });
    workbench.modes.registerMode({
      id: "workspace",
      activate: () => undefined,
      seed: (ctx) => {
        ctx.layout.clearRegion("main");
      },
    });

    workbench.modes.setActiveMode("project");
    await workbench.resources.openResource(projectItem);
    workbench.modes.setActiveMode("workspace");
    await workbench.resources.openResource(workspaceFile);

    const back = workbench.history.goBack();
    await Promise.resolve();

    expect(back?.resource?.id).toBe("PS-1");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceUri).toBe("history.test.project-item:PS-1");

    const forward = workbench.history.goForward();
    await Promise.resolve();

    expect(forward?.resource?.id).toBe("file-a");
    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().activeResourceUri).toBe("history.test.workspace-file:file-a");
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

  // A collection context has no mode. Going back to one has to leave the mode it came
  // from and clear that mode's resource, or the breadcrumb keeps naming the resource the
  // user just navigated away from.
  test("replays an entry with no mode by clearing the mode and its resource", async () => {
    const workbench = setupWorkbench();
    const board = { kind: "board", uri: "board:tickets", id: "tickets", label: "Tickets" };

    workbench.resources.registerKind({ kind: "board", label: "Board" });
    workbench.layout.registerWidget({
      id: "board-viewer",
      title: "Board",
      region: "main",
      singleton: true,
      rendererId: "noop",
      resourceKinds: ["board"],
    });
    workbench.resources.registerPresenter({
      id: "board-presenter",
      canOpen: (resource) => resource.kind === "board",
      open: (resource) => workbench.layout.openPanel("board-viewer", { resource, title: resource.label }),
    });
    workbench.modes.registerMode({
      id: "ticket",
      label: "Ticket",
      resourceKinds: [TICKET_KIND],
      activate: () => undefined,
    });

    await workbench.resources.openResource(board);
    await workbench.navigator.open({
      modeId: "ticket",
      resource: { kind: TICKET_KIND, uri: `${TICKET_KIND}:1`, id: "1", label: "Ticket 1" },
    });
    expect(workbench.modes.getActiveModeId()).toBe("ticket");

    workbench.history.goBack();

    expect(workbench.modes.getActiveModeId()).toBeUndefined();
    expect(workbench.navigator.getSelectedResource()?.uri).toBe(board.uri);
  });

  test("does not duplicate a retained Location while its next mode activates", async () => {
    const workbench = createWorkbenchCore();
    const root = { kind: TICKET_KIND, uri: `${TICKET_KIND}:root`, id: "root", label: "Tickets" };
    const detail = { kind: TICKET_KIND, uri: `${TICKET_KIND}:detail`, id: "detail", label: "Ticket" };

    workbench.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
    workbench.layout.registerLocation({
      id: "ticket-location",
      title: "Tickets",
      region: "main",
      rendererId: "noop",
    });
    workbench.layout.registerWidget({
      id: "ticket-sidenav",
      title: "Ticket sidenav",
      region: "sidenav",
      rendererId: "noop",
    });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.modes.registerMode({
      id: "ticket",
      activate: (ctx) => {
        ctx.layout.openWidget("ticket-sidenav");
      },
    });
    workbench.resources.registerPresenter({
      id: "ticket-location-presenter",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: (resource) => {
        workbench.modes.setActiveMode(resource.id === root.id ? "project" : "ticket");
        return workbench.layout.openPanel("ticket-location", {
          resource,
          strategy: { kind: "replace-active" },
        });
      },
    });

    await workbench.resources.openResource(root);
    await workbench.resources.openResource(detail);

    expect(workbench.history.store.getState().entries.map((entry) => entry.resource?.uri)).toEqual([
      root.uri,
      detail.uri,
    ]);
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

  test("does not record activations outside the main region", async () => {
    const workbench = setupWorkbench();
    await openTicket(workbench, "PS-1");

    // Activating a left-region widget must not push a back/forward entry — history is
    // scoped to the main (primary) region's active placement.
    workbench.layout.openWidget("sidenav");

    const snapshot = workbench.history.store.getState();
    expect(snapshot.entries.map((entry) => entry.resource?.id ?? entry.widgetId)).toEqual(["PS-1"]);
  });

  test("does not record pinned chrome widgets", async () => {
    const workbench = setupWorkbench();

    workbench.layout.openWidget("sidenav", { pinned: true });
    await openTicket(workbench, "PS-1");
    workbench.layout.openWidget("sidenav", { pinned: true });

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
    expect(workbench.layout.getLayout().regions.main.widgets.map((p) => p.widgetId)).toContain("scratch");
  });

  test("removes a closed Location from navigation history", async () => {
    const workbench = setupWorkbench();
    const location = await openTicket(workbench, "PS-1");

    workbench.layout.closePanel(location.instanceId);

    expect(workbench.history.store.getState()).toMatchObject({ entries: [], cursor: -1 });
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

const registerSnapshotFixtures = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  workbench.resources.registerKind({ kind: "snapshot.location", label: "Location" });
  workbench.layout.registerLocation({
    id: "snapshot.location",
    title: "Location",
    region: "main",
    rendererId: "noop",
  });
  for (const region of ["main", "secondary", "side"] as const) {
    for (const name of ["a", "b"]) {
      workbench.layout.registerSubPanel({
        id: `snapshot.${region}.${name}`,
        title: `${region} ${name}`,
        region,
        singleton: true,
        rendererId: "noop",
      });
    }
  }
};

describe("createHistoryController Sub Panel snapshots", () => {
  test("records the Location tab as the selected base Panel", () => {
    const workbench = createWorkbenchCore();
    registerSnapshotFixtures(workbench);
    const location = workbench.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    workbench.layout.openWidget("snapshot.main.a");

    workbench.layout.setRegionActiveWidget("main", location.widgetId);
    const current = workbench.history.store.getState();
    expect(current.entries[current.cursor]?.selectedSubPanels).toEqual({});
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe(location.widgetId);

    expect(workbench.history.goBack()?.selectedSubPanels.main?.contributionId).toBe("snapshot.main.a");
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe("snapshot.main.a");
    expect(workbench.history.goForward()?.selectedSubPanels).toEqual({});
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe(location.widgetId);
  });

  test("restores resource Panel selections without changing the Side Panel", () => {
    const workbench = createWorkbenchCore();
    registerSnapshotFixtures(workbench);
    workbench.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    for (const region of ["main", "secondary", "side"] as const) {
      workbench.layout.openWidget(`snapshot.${region}.a`);
      workbench.layout.openWidget(`snapshot.${region}.b`);
    }

    const entry = workbench.history.goBack();
    expect(entry?.selectedSubPanels.side).toBeUndefined();
    expect(workbench.layout.getLayout().regions.side.activeWidgetId).toBe("snapshot.side.b");
    expect(workbench.layout.getLayout().regions.secondary.activeWidgetId).toBe("snapshot.secondary.a");
  });

  test("keeps Sub Panel selections subordinate to their Location", () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "snapshot.location", label: "Location" });
    workbench.layout.registerLocation({
      id: "snapshot.location",
      title: "Location",
      region: "main",
      singleton: false,
      rendererId: "noop",
    });
    for (const region of ["main", "secondary", "side"] as const) {
      workbench.layout.registerSubPanel({
        id: `snapshot.${region}.owned`,
        title: `${region} owned`,
        region,
        singleton: true,
        rendererId: "noop",
        eligibleLocations: { resourceIds: ["one"] },
      });
    }

    const firstLocation = workbench.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", id: "one", label: "One" },
    });
    for (const region of ["main", "secondary", "side"] as const) {
      workbench.layout.openWidget(`snapshot.${region}.owned`);
    }
    const secondLocation = workbench.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:two", id: "two", label: "Two" },
    });

    const current = workbench.history.store.getState();
    expect(current.entries[current.cursor]?.location.resource?.id).toBe("two");
    expect(current.entries[current.cursor]?.selectedSubPanels).toEqual({});

    expect(workbench.history.goBack()).toMatchObject({
      location: { resource: { id: "one" } },
      selectedSubPanels: {
        main: { contributionId: "snapshot.main.owned" },
        secondary: { contributionId: "snapshot.secondary.owned" },
      },
    });
    expect(workbench.layout.getLayout()).toMatchObject({
      activeLocationWidgetId: firstLocation.widgetId,
      regions: {
        main: { activeWidgetId: "snapshot.main.owned" },
        secondary: { activeWidgetId: "snapshot.secondary.owned" },
        side: { activeWidgetId: "snapshot.side.owned" },
      },
    });

    expect(workbench.history.goForward()).toMatchObject({ location: { resource: { id: "two" } } });
    expect(workbench.layout.getLayout()).toMatchObject({
      activeLocationWidgetId: secondLocation.widgetId,
      regions: {
        main: { activeWidgetId: secondLocation.widgetId },
        secondary: { activeWidgetId: undefined },
        side: { activeWidgetId: "snapshot.side.owned" },
      },
    });

    workbench.layout.activateWidget(firstLocation.widgetId);
    expect(workbench.layout.getLayout()).toMatchObject({
      activeLocationWidgetId: firstLocation.widgetId,
      regions: {
        main: { activeWidgetId: "snapshot.main.owned" },
        secondary: { activeWidgetId: "snapshot.secondary.owned" },
        side: { activeWidgetId: "snapshot.side.owned" },
      },
    });
  });
});

describe("createHistoryController history hydration", () => {
  test("queues cursor movement during async hydration and replays the requested entry after it settles", async () => {
    const histories = new Map<string, import("./history-controller").PersistedWorkbenchHistory>();
    const layouts = new Map<string, import("../../registries/layout/layout-model").WorkbenchLayout>();
    const historyPersistence: import("./history-controller").WorkbenchHistoryPersistence = {
      getHistory: (scope) => histories.get(scope ?? "global"),
      setHistory: (state, scope) => histories.set(scope ?? "global", state),
    };
    const layoutPersistence: import("../../registries/layout/layout-model").LayoutPersistenceAdapter = {
      getLayout: (scope) => layouts.get(scope ?? "global"),
      setLayout: (layout, scope) => layouts.set(scope ?? "global", layout),
    };
    const first = createWorkbenchCore({ historyPersistence, layoutPersistence });
    registerSnapshotFixtures(first);
    first.history.setPersistenceScope("project-one");
    first.layout.setPersistenceScope("project-one");
    first.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    first.layout.openWidget("snapshot.main.a");
    first.layout.openWidget("snapshot.main.b");
    first.history.goBack();
    first.history.flush();

    let finishReplay: () => void = () => undefined;
    const replayGate = new Promise<void>((resolve) => {
      finishReplay = resolve;
    });
    const second = createWorkbenchCore({ historyPersistence, layoutPersistence });
    registerSnapshotFixtures(second);
    second.resources.registerPresenter({
      id: "snapshot.location.presenter",
      canOpen: (resource) => resource.kind === "snapshot.location",
      open: async (resource) => {
        const location = second.layout.openPanel("snapshot.location", {
          role: "location",
          resource,
          strategy: { kind: "replace-active" },
        });
        await replayGate;
        return location;
      },
    });
    second.history.setPersistenceScope("project-one");
    second.layout.setPersistenceScope("project-one");

    expect(second.history.store.getState().hydrating).toBe(true);
    second.history.restore();
    expect(second.history.store.getState().hydrating).toBe(true);
    expect(second.history.goForward()?.selectedSubPanels.main?.contributionId).toBe("snapshot.main.b");
    expect(second.history.store.getState().cursor).toBe(2);

    finishReplay();
    await replayGate;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(second.history.store.getState().hydrating).toBe(false);
    expect(second.layout.getLayout().regions.main.activeWidgetId).toBe("snapshot.main.b");
  });

  test("does not finish a new scope's hydration when the previous scope replay settles", async () => {
    const histories = new Map<string, import("./history-controller").PersistedWorkbenchHistory>();
    const layouts = new Map<string, import("../../registries/layout/layout-model").WorkbenchLayout>();
    const historyPersistence: import("./history-controller").WorkbenchHistoryPersistence = {
      getHistory: (scope) => histories.get(scope ?? "global"),
      setHistory: (state, scope) => histories.set(scope ?? "global", state),
    };
    const layoutPersistence: import("../../registries/layout/layout-model").LayoutPersistenceAdapter = {
      getLayout: (scope) => layouts.get(scope ?? "global"),
      setLayout: (layout, scope) => layouts.set(scope ?? "global", layout),
    };
    const first = createWorkbenchCore({ historyPersistence, layoutPersistence });
    registerSnapshotFixtures(first);
    for (const scope of ["project-one", "project-two"]) {
      first.layout.setPersistenceScope(scope);
      first.history.setPersistenceScope(scope);
      first.layout.openWidget("snapshot.location", {
        role: "location",
        resource: { kind: "snapshot.location", uri: `snapshot.location:${scope}`, label: scope },
      });
      first.layout.openWidget("snapshot.main.a");
      if (scope === "project-two") first.layout.openWidget("snapshot.main.b");
      first.history.flush();
    }

    let finishFirstReplay: () => void = () => undefined;
    const firstReplayGate = new Promise<void>((resolve) => {
      finishFirstReplay = resolve;
    });
    const second = createWorkbenchCore({ historyPersistence, layoutPersistence });
    registerSnapshotFixtures(second);
    second.resources.registerPresenter({
      id: "snapshot.location.presenter",
      canOpen: (resource) => resource.kind === "snapshot.location",
      open: async (resource) => {
        const location = second.layout.openPanel("snapshot.location", {
          role: "location",
          resource,
          strategy: { kind: "replace-active" },
        });
        await firstReplayGate;
        return location;
      },
    });

    second.layout.setPersistenceScope("project-one");
    second.history.setPersistenceScope("project-one");
    second.history.restore();
    second.history.setPersistenceScope("project-two");
    second.layout.setPersistenceScope("project-two");
    expect(second.layout.getLayout().regions.main.activeWidgetId).toBe("snapshot.main.b");

    finishFirstReplay();
    await firstReplayGate;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(second.history.getPersistenceScope()).toBe("project-two");
    expect(second.history.store.getState().hydrating).toBe(true);
    expect(second.layout.getLayout().regions.main.activeWidgetId).toBe("snapshot.main.b");
  });
});

describe("createHistoryController persisted Sub Panel snapshots", () => {
  test("persists entries and cursor per project scope", () => {
    const states = new Map<string, import("./history-controller").PersistedWorkbenchHistory>();
    const persistence: import("./history-controller").WorkbenchHistoryPersistence = {
      getHistory: (scope) => states.get(scope ?? "global"),
      setHistory: (state, scope) => states.set(scope ?? "global", state),
    };
    const first = createWorkbenchCore({ historyPersistence: persistence });
    registerSnapshotFixtures(first);
    first.history.setPersistenceScope("project-one");
    first.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    first.layout.openWidget("snapshot.main.a");
    first.layout.openWidget("snapshot.main.b");
    first.history.goBack();
    first.history.flush();

    const second = createWorkbenchCore({ historyPersistence: persistence });
    registerSnapshotFixtures(second);
    second.history.setPersistenceScope("project-one");

    expect(second.history.store.getState().entries).toHaveLength(3);
    expect(second.history.store.getState().cursor).toBe(1);
    second.history.restore();
    expect(second.history.goForward()?.selectedSubPanels.main?.contributionId).toBe("snapshot.main.b");
  });

  test("restores the cursor entry and Forward entries after refreshing from the middle", () => {
    const histories = new Map<string, import("./history-controller").PersistedWorkbenchHistory>();
    const layouts = new Map<string, import("../../registries/layout/layout-model").WorkbenchLayout>();
    const historyPersistence: import("./history-controller").WorkbenchHistoryPersistence = {
      getHistory: (scope) => histories.get(scope ?? "global"),
      setHistory: (state, scope) => histories.set(scope ?? "global", state),
    };
    const layoutPersistence: import("../../registries/layout/layout-model").LayoutPersistenceAdapter = {
      getLayout: (scope) => layouts.get(scope ?? "global"),
      setLayout: (layout, scope) => layouts.set(scope ?? "global", layout),
    };
    const first = createWorkbenchCore({ historyPersistence, layoutPersistence });
    registerSnapshotFixtures(first);
    first.layout.setPersistenceScope("project-one");
    first.history.setPersistenceScope("project-one");
    first.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    first.layout.openWidget("snapshot.main.a");
    first.layout.openWidget("snapshot.main.b");
    first.history.goBack();
    first.history.flush();

    const second = createWorkbenchCore({ historyPersistence, layoutPersistence });
    registerSnapshotFixtures(second);
    second.layout.setPersistenceScope("project-one");
    second.history.setPersistenceScope("project-one");
    second.history.restore();

    expect(second.layout.getLayout().regions.main.activeWidgetId).toBe("snapshot.main.a");
    expect(second.history.goForward()?.selectedSubPanels.main?.contributionId).toBe("snapshot.main.b");
    expect(second.layout.getLayout().regions.main.activeWidgetId).toBe("snapshot.main.b");
  });

  test("does not truncate persisted Forward entries while contributions finish hydrating", () => {
    const states = new Map<string, import("./history-controller").PersistedWorkbenchHistory>();
    const persistence: import("./history-controller").WorkbenchHistoryPersistence = {
      getHistory: (scope) => states.get(scope ?? "global"),
      setHistory: (state, scope) => states.set(scope ?? "global", state),
    };
    const first = createWorkbenchCore({ historyPersistence: persistence });
    registerSnapshotFixtures(first);
    first.history.setPersistenceScope("project-one");
    first.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    first.layout.openWidget("snapshot.main.a");
    first.layout.openWidget("snapshot.main.b");
    first.history.goBack();
    first.history.flush();

    const second = createWorkbenchCore({ historyPersistence: persistence });
    registerSnapshotFixtures(second);
    second.history.setPersistenceScope("project-one");

    second.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    second.layout.openWidget("snapshot.main.b");
    second.history.restore();

    expect(second.history.store.getState().cursor).toBe(1);
    expect(second.history.goForward()?.selectedSubPanels.main?.contributionId).toBe("snapshot.main.b");
  });

  test("keeps each project's timeline and workspace isolated", () => {
    const histories = new Map<string, import("./history-controller").PersistedWorkbenchHistory>();
    const layouts = new Map<string, import("../../registries/layout/layout-model").WorkbenchLayout>();
    const workbench = createWorkbenchCore({
      historyPersistence: {
        getHistory: (scope) => histories.get(scope ?? "global"),
        setHistory: (state, scope) => histories.set(scope ?? "global", state),
      },
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope ?? "global"),
        setLayout: (layout, scope) => layouts.set(scope ?? "global", layout),
      },
    });
    registerSnapshotFixtures(workbench);

    workbench.layout.setPersistenceScope("project-one");
    workbench.history.setPersistenceScope("project-one");
    workbench.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    workbench.layout.openWidget("snapshot.main.a");

    workbench.layout.setPersistenceScope("project-two");
    workbench.history.setPersistenceScope("project-two");
    workbench.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:two", label: "Two" },
    });
    workbench.layout.openWidget("snapshot.main.b");

    workbench.layout.setPersistenceScope("project-one");
    workbench.history.setPersistenceScope("project-one");
    workbench.history.restore();
    expect(workbench.history.store.getState().entries.at(-1)?.location.resource?.uri).toBe("snapshot.location:one");
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe("snapshot.main.a");

    workbench.layout.setPersistenceScope("project-two");
    workbench.history.setPersistenceScope("project-two");
    workbench.history.restore();
    expect(workbench.history.store.getState().entries.at(-1)?.location.resource?.uri).toBe("snapshot.location:two");
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe("snapshot.main.b");
  });

  test("persists recently closed Sub Panels and reopens them after refresh", () => {
    const states = new Map<string, import("./history-controller").PersistedWorkbenchHistory>();
    const persistence: import("./history-controller").WorkbenchHistoryPersistence = {
      getHistory: (scope) => states.get(scope ?? "global"),
      setHistory: (state, scope) => states.set(scope ?? "global", state),
    };
    const first = createWorkbenchCore({ historyPersistence: persistence });
    registerSnapshotFixtures(first);
    first.history.setPersistenceScope("project-one");
    first.layout.openWidget("snapshot.location", {
      role: "location",
      resource: { kind: "snapshot.location", uri: "snapshot.location:one", label: "One" },
    });
    const subPanel = first.layout.openWidget("snapshot.side.a");
    first.layout.closeWidget(subPanel.widgetId);
    first.history.flush();

    const second = createWorkbenchCore({ historyPersistence: persistence });
    registerSnapshotFixtures(second);
    second.history.setPersistenceScope("project-one");
    second.history.restore();

    expect(second.history.recentlyClosed()).toHaveLength(1);
    second.history.reopenLastClosed();
    expect(second.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({ contributionId: "snapshot.side.a" }),
    ]);
  });

  test("reconciles unavailable Locations and Sub Panels after contributions register", () => {
    const persistence: import("./history-controller").WorkbenchHistoryPersistence = {
      getHistory: () => ({
        version: 1,
        cursor: 1,
        entries: [
          {
            entryId: "missing-location",
            recordedAt: 1,
            kind: "widget",
            location: { key: "missing", contributionId: "snapshot.missing" },
            contributionId: "snapshot.missing",
            selectedSubPanels: {},
          },
          {
            entryId: "valid-location",
            recordedAt: 2,
            kind: "widget",
            location: { key: "valid", contributionId: "snapshot.location" },
            contributionId: "snapshot.location",
            selectedSubPanels: {
              main: { contributionId: "snapshot.missing-sub-panel" },
            },
          },
        ],
        recentlyClosed: [],
      }),
      setHistory: () => undefined,
    };
    const workbench = createWorkbenchCore({ historyPersistence: persistence });
    registerSnapshotFixtures(workbench);
    workbench.history.setPersistenceScope("project-one");

    workbench.history.restore();

    expect(workbench.history.store.getState().entries).toEqual([
      expect.objectContaining({ entryId: "valid-location", selectedSubPanels: {} }),
    ]);
    expect(workbench.history.store.getState().cursor).toBe(0);
  });
});

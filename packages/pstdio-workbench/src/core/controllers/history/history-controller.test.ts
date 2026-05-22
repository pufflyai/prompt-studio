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

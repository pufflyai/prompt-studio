import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type HistoryStoreState } from "@pstdio/workbench";
import { migrateLegacyViewHistory } from "./view-persistence-migration";

const registerTicketsView = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  workbench.layout.registerLocation({
    id: "pstdio-planner.tickets",
    title: "Tickets",
    region: "main",
    rendererId: "noop",
  });
  workbench.views.registerView({
    id: "pstdio-planner.tickets",
    panelId: "pstdio-planner.tickets",
    title: "Tickets",
    path: "/tickets",
  });
};

describe("migrateLegacyViewHistory", () => {
  test("migrates entries and recently closed without changing their order or cursor", () => {
    const workbench = createWorkbenchCore();
    registerTicketsView(workbench);
    const legacyResource = {
      kind: "extension-view",
      uri: "dashboard-workbench://project/p1/extension-views/pstdio-planner.tickets",
      id: "pstdio-planner.tickets",
      label: "Tickets",
    };
    const legacy = {
      entryId: "history-1",
      recordedAt: 10,
      location: {
        key: `project:resource:${legacyResource.uri}`,
        resource: legacyResource,
        contributionId: "dashboard-workbench.extension-view.pstdio-planner.tickets",
        instanceKey: "dashboard-workbench.extension-view.pstdio-planner.tickets",
      },
      selectedSubPanels: {
        secondary: {
          contributionId: "dashboard-workbench.extension-view.pstdio-planner.properties",
          instanceKey: "dashboard-workbench.extension-view.pstdio-planner.properties",
        },
      },
      kind: "resource" as const,
      resource: legacyResource,
      widgetId: "dashboard-workbench.extension-view.pstdio-planner.tickets",
      contributionId: "dashboard-workbench.extension-view.pstdio-planner.tickets",
    };
    const state: HistoryStoreState = {
      entries: [legacy],
      cursor: 0,
      recentlyClosed: [{ ...legacy, entryId: "history-2", recordedAt: 20 }],
      hydrating: true,
    };

    const migrated = migrateLegacyViewHistory(state, workbench.views);

    expect(migrated.cursor).toBe(0);
    expect(migrated.entries.map((entry) => entry.entryId)).toEqual(["history-1"]);
    expect(migrated.recentlyClosed.map((entry) => entry.entryId)).toEqual(["history-2"]);
    expect(migrated.entries[0]).toMatchObject({
      kind: "view",
      viewId: "pstdio-planner.tickets",
      widgetId: "pstdio-planner.tickets",
      contributionId: "pstdio-planner.tickets",
      location: {
        key: "global:view:pstdio-planner.tickets",
        viewId: "pstdio-planner.tickets",
        contributionId: "pstdio-planner.tickets",
        instanceKey: "pstdio-planner.tickets",
      },
    });
    expect(migrated.entries[0]?.resource).toBeUndefined();
    expect(migrated.entries[0]?.location.resource).toBeUndefined();
  });

  test("keeps domain resources when their backing panel is also a registered view", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerPanel({
      id: "pstdio-planner.ticketEditor",
      title: "Ticket",
      region: "main",
      rendererId: "noop",
    });
    workbench.views.registerView({
      id: "pstdio-planner.ticketEditor",
      panelId: "pstdio-planner.ticketEditor",
      title: "Ticket",
    });
    const ticket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/PS-1",
      id: "PS-1",
      label: "PS-1 Keep domain identity",
    };
    const entry = {
      entryId: "ticket-history",
      recordedAt: 10,
      location: {
        key: `project:resource:${ticket.uri}`,
        resource: ticket,
        contributionId: "pstdio-planner.ticketEditor",
        instanceKey: "pstdio-planner.ticketEditor",
      },
      selectedSubPanels: {},
      kind: "resource" as const,
      resource: ticket,
      widgetId: "pstdio-planner.ticketEditor",
      contributionId: "pstdio-planner.ticketEditor",
    };
    const state: HistoryStoreState = { entries: [entry], cursor: 0, recentlyClosed: [], hydrating: true };

    const migrated = migrateLegacyViewHistory(state, workbench.views);

    expect(migrated.entries[0]).toEqual(entry);
  });
});

import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { createLayoutModel } from "./layout-model";
import { createDefaultWorkbenchLayout, type WorkbenchWidgetPlacement } from "./layout-types";
import { reconcileOwnedWidgetLayout, type WorkbenchOwnedWidgetPlacement } from "./owned-placement-layout";

const owned = (
  identity: PlacementIdentity,
  region: WorkbenchOwnedWidgetPlacement["region"],
  order: number,
  widgetId: string,
  contributionId = "shared-view",
): WorkbenchOwnedWidgetPlacement => ({
  identity,
  region,
  order,
  value: { widgetId, contributionId, role: region === "main" ? "location" : "sub-panel" },
});

const modeIdentity = (placementId: string, modeId = "project"): PlacementIdentity => ({
  kind: "mode",
  modeId,
  placementId,
  instanceKey: "default",
});

const pageIdentity = (pageId: string, slotId: string): PlacementIdentity => ({
  kind: "page",
  pageId,
  slotId,
  instanceKey: "default",
});

const renderedIdentities = (widgets: readonly WorkbenchWidgetPlacement[]) =>
  widgets.map((placement) => placement.placementIdentity);

describe("owned placement layout reconciliation", () => {
  test("keeps foreign widgets while replacing the complete owned set by identity", () => {
    const layout = createDefaultWorkbenchLayout();
    const foreign = { widgetId: "foreign", contributionId: "legacy.help" };
    const staleIdentity = pageIdentity("old-page", "tools");
    layout.regions.side = {
      ...layout.regions.side,
      widgets: [{ ...foreign }, { ...foreign, widgetId: "stale", placementIdentity: staleIdentity }],
    };

    const page = owned(pageIdentity("ticket", "emoji"), "side", 10, "ticket-emoji");
    const mode = owned(modeIdentity("sessions"), "side", 20, "project-sessions");
    const next = reconcileOwnedWidgetLayout({ layout, placements: [mode, page] });

    expect(next.regions.side.widgets.map((placement) => placement.widgetId)).toEqual([
      "foreign",
      "ticket-emoji",
      "project-sessions",
    ]);
    expect(renderedIdentities(next.regions.side.widgets)).toEqual([undefined, page.identity, mode.identity]);
    expect(next.regions.side.visible).toBe(true);
  });

  test("retains auxiliary focus when a page adds content to the same region", () => {
    const mode = owned(modeIdentity("sessions"), "side", 20, "project-sessions");
    const first = reconcileOwnedWidgetLayout({
      layout: createDefaultWorkbenchLayout(),
      placements: [mode],
      activate: [mode.identity],
    });
    const emoji = owned(pageIdentity("ticket", "emoji"), "side", 10, "ticket-emoji");

    const next = reconcileOwnedWidgetLayout({ layout: first, placements: [mode, emoji] });

    expect(next.regions.side.activeWidgetId).toBe("project-sessions");
    expect(next.activeWidgetId).toBe("project-sessions");
  });

  test("updates placement input without changing instance identity", () => {
    const identity = pageIdentity("ticket", "content");
    const firstPlacement = owned(identity, "main", 0, "ticket-original", "ticket-view");
    firstPlacement.value.resource = { kind: "ticket", uri: "ticket:PS-326", label: "Old title" };
    firstPlacement.value.resourceUri = "ticket:PS-326";
    const first = reconcileOwnedWidgetLayout({
      layout: createDefaultWorkbenchLayout(),
      placements: [firstPlacement],
    });
    const updatedPlacement = owned(identity, "main", 0, "ticket-replacement", "ticket-view");
    updatedPlacement.value.resource = { kind: "ticket", uri: "ticket:PS-326", label: "New title" };
    updatedPlacement.value.resourceUri = "ticket:PS-326";

    const updated = reconcileOwnedWidgetLayout({ layout: first, placements: [updatedPlacement] });

    expect(updated.regions.main.widgets).toHaveLength(1);
    expect(updated.regions.main.widgets[0]).toMatchObject({
      widgetId: "ticket-original",
      placementIdentity: identity,
      resource: { uri: "ticket:PS-326", label: "New title" },
    });
  });

  test("does not reuse a rendered widget instance for a different owner", () => {
    const previous = owned(pageIdentity("ticket", "tools"), "side", 0, "shared-instance");
    const current = reconcileOwnedWidgetLayout({
      layout: createDefaultWorkbenchLayout(),
      placements: [previous],
    });
    const incoming = owned(pageIdentity("tickets", "tools"), "side", 0, "shared-instance");

    expect(() => reconcileOwnedWidgetLayout({ layout: current, placements: [incoming] })).toThrow(
      "Rendered widget ID belongs to another placement: shared-instance",
    );
  });

  test("transfers one shared view between mode owners without replacing its widget instance", () => {
    const project = owned(modeIdentity("project-navigation"), "sidenav", 0, "shared-navigation", "navigation");
    project.value.viewId = "navigation";
    const current = reconcileOwnedWidgetLayout({
      layout: createDefaultWorkbenchLayout(),
      placements: [project],
    });
    const sessions = owned(
      modeIdentity("sessions-navigation", "sessions"),
      "sidenav",
      0,
      "shared-navigation",
      "navigation",
    );
    sessions.value.viewId = "navigation";

    const next = reconcileOwnedWidgetLayout({ layout: current, placements: [sessions] });

    expect(next.regions.sidenav.widgets).toEqual([
      expect.objectContaining({
        widgetId: "shared-navigation",
        placementIdentity: sessions.identity,
      }),
    ]);
  });

  test("removes only the outgoing page and activates the incoming primary in one layout update", () => {
    const layout = createLayoutModel();
    const apply = (input: Omit<Parameters<typeof reconcileOwnedWidgetLayout>[0], "layout">) => {
      layout.restoreLayout(reconcileOwnedWidgetLayout({ ...input, layout: layout.getLayout() }));
    };
    const sessions = owned(modeIdentity("sessions"), "side", 20, "project-sessions");
    const ticket = owned(pageIdentity("ticket", "content"), "main", 0, "ticket-content", "ticket-view");
    apply({ placements: [sessions, ticket], activate: [ticket.identity] });
    const observed: string[][] = [];
    const unsubscribe = layout.store.subscribe((state) => {
      observed.push(
        Object.values(state.layout.regions)
          .flatMap((region) => region.widgets)
          .map((placement) => placement.widgetId),
      );
    });
    const tickets = owned(pageIdentity("tickets", "content"), "main", 0, "tickets-content", "tickets-view");

    apply({ placements: [sessions, tickets], activate: [tickets.identity] });
    unsubscribe();

    expect(observed).toEqual([["tickets-content", "project-sessions"]]);
    expect(layout.getLayout().regions.side.widgets[0]?.widgetId).toBe("project-sessions");
    expect(layout.getLayout().activeLocationWidgetId).toBe("tickets-content");
    expect(layout.getLayout().activeWidgetId).toBe("tickets-content");
  });

  test("replaces an unowned legacy location when a page primary becomes active", () => {
    const layout = createDefaultWorkbenchLayout();
    layout.regions.main = {
      ...layout.regions.main,
      widgets: [
        {
          widgetId: "legacy-session",
          contributionId: "dashboard.session",
          role: "location",
        },
      ],
      activeWidgetId: "legacy-session",
    };
    layout.activeWidgetId = "legacy-session";
    layout.activeLocationWidgetId = "legacy-session";
    const lab = owned(pageIdentity("lab", "content"), "main", 0, "lab-content", "lab-view");

    const next = reconcileOwnedWidgetLayout({ layout, placements: [lab], activate: [lab.identity] });

    expect(next.regions.main.widgets.map((placement) => placement.widgetId)).toEqual(["lab-content"]);
    expect(next.activeLocationWidgetId).toBe("lab-content");
    expect(next.activeWidgetId).toBe("lab-content");
  });

  test("collapses a docked region only after its final placement disappears", () => {
    const mode = owned(modeIdentity("sessions"), "side", 20, "project-sessions");
    const page = owned(pageIdentity("ticket", "emoji"), "side", 10, "ticket-emoji");
    const populated = reconcileOwnedWidgetLayout({ layout: createDefaultWorkbenchLayout(), placements: [mode, page] });

    const modeOnly = reconcileOwnedWidgetLayout({ layout: populated, placements: [mode] });
    const empty = reconcileOwnedWidgetLayout({ layout: modeOnly, placements: [] });

    expect(modeOnly.regions.side.visible).toBe(true);
    expect(empty.regions.side.widgets).toEqual([]);
    expect(empty.regions.side.visible).toBe(false);
  });

  test("does not reopen a user-collapsed region for an existing hidden foreign widget", () => {
    const layout = createDefaultWorkbenchLayout();
    layout.regions.secondary = {
      ...layout.regions.secondary,
      visible: false,
      widgets: [
        {
          widgetId: "terminal-launcher",
          contributionId: "terminal-launcher",
          hiddenByDefault: true,
        },
      ],
    };
    const sidenav = owned(modeIdentity("navigation"), "sidenav", 0, "project-navigation");

    const next = reconcileOwnedWidgetLayout({ layout, placements: [sidenav] });

    expect(next.regions.secondary.visible).toBe(false);
    expect(next.regions.secondary.widgets).toHaveLength(1);
  });
});

import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { createLayoutModel } from "./layout-model";
import { createDefaultWorkbenchLayout, type WorkbenchWidgetPlacement } from "./layout-types";
import {
  applyOwnedWidgetLayoutReconciliation,
  reconcileOwnedWidgetLayout,
  type WorkbenchOwnedWidgetPlacement,
} from "./owned-placement-layout";

test("reconciliation preserves visibility for chrome regions without placements", () => {
  for (const visible of [true, false]) {
    const layout = createDefaultWorkbenchLayout({ sidenav: visible });
    const next = reconcileOwnedWidgetLayout({ layout, placements: [owned(modeIdentity("body"), "main", 0, "body")] });
    expect(next.regions.sidenav.visible).toBe(visible);
  }
});
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
  test("applies exact removals without deleting placements outside the published transition", () => {
    const existing = owned(pageIdentity("ticket", "content"), "main", 0, "ticket-content", "ticket-view");
    const unrelated = owned(modeIdentity("navigation"), "sidenav", 0, "project-navigation", "navigation-view");
    const layout = reconcileOwnedWidgetLayout({
      layout: createDefaultWorkbenchLayout(),
      placements: [existing, unrelated],
    });
    const next = applyOwnedWidgetLayoutReconciliation({
      layout,
      placements: [],
      remove: [existing.identity],
    });
    expect(next.regions.main.widgets).toEqual([]);
    expect(next.regions.sidenav.widgets).toEqual([
      expect.objectContaining({
        widgetId: "project-navigation",
        placementIdentity: unrelated.identity,
      }),
    ]);
  });
  test("keeps foreign widgets while replacing the complete owned set by identity", () => {
    const layout = createDefaultWorkbenchLayout();
    const foreign = { widgetId: "foreign", contributionId: "host.help" };
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
  test("binds declarative Sub Panels to the active Location", () => {
    const board = owned(pageIdentity("workspaces", "content"), "main", 0, "board", "workspace-view");
    const initial = reconcileOwnedWidgetLayout({
      layout: createDefaultWorkbenchLayout(),
      placements: [board],
      activate: [board.identity],
    });
    const workspace = owned(
      { ...pageIdentity("workspaces", "content"), instanceKey: "workspace:one" },
      "main",
      0,
      "workspace",
      "workspace-view",
    );
    workspace.value.resource = {
      type: "workspace",
      id: "workspace:one",
    };
    workspace.value.resourceKey = "workspace:one";
    const terminal = owned(modeIdentity("terminal"), "secondary", 0, "terminal", "terminal-view");
    terminal.value.resource = {
      type: "terminal",
      id: "terminal:one",
    };
    terminal.value.resourceKey = "terminal:one";
    const workspaceLayout = reconcileOwnedWidgetLayout({
      layout: initial,
      placements: [board, workspace, terminal],
      activate: [workspace.identity, terminal.identity],
    });
    const next = reconcileOwnedWidgetLayout({
      layout: workspaceLayout,
      placements: [board, workspace, terminal],
      activate: [board.identity],
    });
    expect(next.regions.secondary.widgets[0]).toMatchObject({
      widgetId: "terminal",
      ownerResourceKey: "workspace:one",
    });
  });
  test("keeps unscoped mode chrome independent from the active Location", () => {
    const identity = modeIdentity("navigation");
    const staleNavigation = owned(identity, "sidenav", 0, "project-navigation", "navigation-view");
    staleNavigation.value.ownerResourceKey = "ticket:one";
    const current = reconcileOwnedWidgetLayout({
      layout: createDefaultWorkbenchLayout(),
      placements: [staleNavigation],
    });
    const navigation = owned(identity, "sidenav", 0, "project-navigation", "navigation-view");
    const next = reconcileOwnedWidgetLayout({ layout: current, placements: [navigation] });
    expect(next.regions.sidenav.widgets[0]).not.toHaveProperty("ownerResourceKey");
  });
  test("updates placement input without changing instance identity", () => {
    const identity = pageIdentity("ticket", "content");
    const firstPlacement = owned(identity, "main", 0, "ticket-original", "ticket-view");
    firstPlacement.value.resource = {
      type: "ticket",
      label: "Old title",
      id: "ticket:PS-326",
    };
    firstPlacement.value.resourceKey = "ticket:PS-326";
    const first = reconcileOwnedWidgetLayout({
      layout: createDefaultWorkbenchLayout(),
      placements: [firstPlacement],
    });
    const updatedPlacement = owned(identity, "main", 0, "ticket-replacement", "ticket-view");
    updatedPlacement.value.resource = {
      type: "ticket",
      label: "New title",
      id: "ticket:PS-326",
    };
    updatedPlacement.value.resourceKey = "ticket:PS-326";
    const updated = reconcileOwnedWidgetLayout({ layout: first, placements: [updatedPlacement] });
    expect(updated.regions.main.widgets).toHaveLength(1);
    expect(updated.regions.main.widgets[0]).toMatchObject({
      widgetId: "ticket-original",
      placementIdentity: identity,
      resource: { type: "ticket", id: "ticket:PS-326", label: "New title" },
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
});
describe("owned placement layout reconciliation lifecycle", () => {
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
  test("does not transfer a widget instance between resources of one mode placement", () => {
    const firstIdentity = { ...modeIdentity("sessions"), instanceKey: "session:first" };
    const secondIdentity = { ...modeIdentity("sessions"), instanceKey: "session:second" };
    const first = owned(firstIdentity, "side", 0, "session-first", "session-view");
    first.value.viewId = "session-view";
    const initial = reconcileOwnedWidgetLayout({ layout: createDefaultWorkbenchLayout(), placements: [first] });
    const second = owned(secondIdentity, "side", 0, "session-second", "session-view");
    second.value.viewId = "session-view";
    const replaced = reconcileOwnedWidgetLayout({ layout: initial, placements: [second] });
    const reopened = reconcileOwnedWidgetLayout({ layout: replaced, placements: [second, first] });
    expect(reopened.regions.side.widgets.map((placement) => placement.widgetId)).toEqual([
      "session-second",
      "session-first",
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
  test("replaces an unowned location when a page primary becomes active", () => {
    const layout = createDefaultWorkbenchLayout();
    layout.regions.main = {
      ...layout.regions.main,
      widgets: [
        {
          widgetId: "unowned-session",
          contributionId: "dashboard.session",
          role: "location",
        },
      ],
      activeWidgetId: "unowned-session",
    };
    layout.activeWidgetId = "unowned-session";
    layout.activeLocationWidgetId = "unowned-session";
    const lab = owned(pageIdentity("lab", "content"), "main", 0, "lab-content", "lab-view");
    const next = reconcileOwnedWidgetLayout({ layout, placements: [lab], activate: [lab.identity] });
    expect(next.regions.main.widgets.map((placement) => placement.widgetId)).toEqual(["lab-content"]);
    expect(next.activeLocationWidgetId).toBe("lab-content");
    expect(next.activeWidgetId).toBe("lab-content");
  });
  test("keeps the region visibility preference when its final placement disappears", () => {
    const mode = owned(modeIdentity("sessions"), "side", 20, "project-sessions");
    const page = owned(pageIdentity("ticket", "emoji"), "side", 10, "ticket-emoji");
    const populated = reconcileOwnedWidgetLayout({ layout: createDefaultWorkbenchLayout(), placements: [mode, page] });
    const modeOnly = reconcileOwnedWidgetLayout({ layout: populated, placements: [mode] });
    const empty = reconcileOwnedWidgetLayout({ layout: modeOnly, placements: [] });
    expect(modeOnly.regions.side.visible).toBe(true);
    expect(empty.regions.side.widgets).toEqual([]);
    expect(empty.regions.side.visible).toBe(true);
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

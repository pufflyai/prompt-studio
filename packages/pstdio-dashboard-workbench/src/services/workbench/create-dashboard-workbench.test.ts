import { describe, expect, test } from "bun:test";
import { createDashboardWorkbench } from "./create-dashboard-workbench";
import { dashboardCommandIds, dashboardWidgetIds } from "./ids";
import {
  sessionResource,
  settingsSectionResource,
  ticketResource,
  workspaceResource,
} from "./resources/resource-kinds";

// The keep-alive renderer needs a host element; bun tests have no DOM, so a
// minimal stub stands in for `document.createElement`.
const createTestWorkbench = (projectId: string) =>
  createDashboardWorkbench(projectId, {
    renderers: { createHost: () => ({ style: {} }) as unknown as HTMLElement },
  });

describe("createDashboardWorkbench", () => {
  test("scopes layout persistence to the project", () => {
    const workbench = createTestWorkbench("proj-1");
    expect(workbench.layout.getPersistenceScope()).toBe("project:proj-1");
  });

  test("registers a resource kind for every dashboard surface", () => {
    const workbench = createTestWorkbench("proj-1");
    const kinds = workbench.resources.listKinds().map((entry) => entry.kind);
    for (const expected of [
      "dashboard-view",
      "ticket",
      "workspace",
      "session",
      "settings-section",
      "extension-route",
    ]) {
      expect(kinds).toContain(expected);
    }
  });

  test("registers resource openers and a navigation parser", () => {
    const workbench = createTestWorkbench("proj-1");
    expect(workbench.resources.listOpeners().length).toBeGreaterThanOrEqual(4);
    expect(workbench.navigation.listParsers().length).toBeGreaterThanOrEqual(1);
  });

  test("registers the session chat as a keep-alive renderer", () => {
    const workbench = createTestWorkbench("proj-1");
    const renderer = workbench.renderers.store.getState().renderers[dashboardWidgetIds.sessionChat];
    expect(renderer?.keepAlive).toBe(true);
  });

  test("registers navigation commands surfaced through the command palette", () => {
    const workbench = createTestWorkbench("proj-1");
    const commandIds = workbench.commands.listCommands().map((entry) => entry.command.id);
    expect(commandIds).toContain(dashboardCommandIds.openTickets);
    expect(commandIds).toContain(dashboardCommandIds.toggleSessionChat);
    expect(commandIds).toContain(dashboardCommandIds.back);
  });

  test("opens a resource into a main-area widget placement through its opener", async () => {
    const workbench = createTestWorkbench("proj-1");
    await workbench.resources.openResource(ticketResource("PS-298", "Sample"));

    const mainWidgets = workbench.layout.getLayout().areas.main.widgets;
    expect(mainWidgets.some((placement) => placement.contributionId === dashboardWidgetIds.ticketDetail)).toBe(true);
  });

  test("keeps the keep-alive session chat parked in the floating area", () => {
    const workbench = createTestWorkbench("proj-1");
    const floatingWidgets = workbench.layout.getLayout().areas.floating.widgets;
    expect(floatingWidgets.some((placement) => placement.contributionId === dashboardWidgetIds.sessionChat)).toBe(true);
  });

  test("opens selected sessions into the keep-alive chat placement", async () => {
    const workbench = createTestWorkbench("proj-1");
    const session = sessionResource("session-1", "Investigate failure");

    await workbench.resources.openResource(session);

    const floatingWidgets = workbench.layout.getLayout().areas.floating.widgets;
    const chatPlacement = floatingWidgets.find(
      (placement) => placement.contributionId === dashboardWidgetIds.sessionChat,
    );
    expect(chatPlacement?.resource).toEqual(session);
    expect(workbench.sessionPanel.getMode()).toBe("attached");
  });

  test("smoke opens the ticket, workspace, session, and settings surfaces", async () => {
    const workbench = createTestWorkbench("proj-1");

    await workbench.resources.openResource(ticketResource("PS-298", "Dashboard workbench"));
    await workbench.resources.openResource(workspaceResource("PS-298_A1", { label: "Attempt 1" }));
    await workbench.resources.openResource(sessionResource("session-1", "Run tests"));
    await workbench.resources.openResource(settingsSectionResource("agents"));

    const layout = workbench.layout.getLayout();
    expect(
      layout.areas.main.widgets.some((placement) => placement.contributionId === dashboardWidgetIds.ticketDetail),
    ).toBe(true);
    expect(
      layout.areas.main.widgets.some((placement) => placement.contributionId === dashboardWidgetIds.workspaceDetail),
    ).toBe(true);
    expect(
      layout.areas.main.widgets.some((placement) => placement.contributionId === dashboardWidgetIds.settings),
    ).toBe(true);
    expect(layout.areas.floating.widgets.some((placement) => placement.resource?.id === "session-1")).toBe(true);
  });
});

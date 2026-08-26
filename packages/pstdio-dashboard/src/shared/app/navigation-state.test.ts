import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import {
  getDashboardSelectedResource,
  prepareDashboardNavigationResource,
  resolveDashboardLayoutPersistenceScope,
  selectDashboardNavigationResource,
  selectDashboardNavigationView,
} from "./navigation-state";
import { selectDashboardProject } from "./project-context";
import { dashboardViews } from "./resources";

describe("resolveDashboardLayoutPersistenceScope", () => {
  test("uses canonical resource, aggregate, and empty scopes", () => {
    expect(
      resolveDashboardLayoutPersistenceScope({
        projectId: "project-1",
        modeId: "workspace",
        resource: { kind: "workspace", uri: "dashboard-workbench://workspace/workspace-1" },
      }),
    ).toBe("project/project-1/mode/workspace/resource/dashboard-workbench://workspace/workspace-1");
    expect(
      resolveDashboardLayoutPersistenceScope({
        activeCollection: "tickets",
        modeId: "project",
        projectId: "project-1",
      }),
    ).toBe("project/project-1/mode/project/aggregate/tickets");
    expect(
      resolveDashboardLayoutPersistenceScope({
        modeId: "project",
        projectId: "project-1",
      }),
    ).toBe("project/project-1/mode/project/aggregate/empty");
    expect(resolveDashboardLayoutPersistenceScope({ modeId: "project" })).toBeUndefined();
  });
});

describe("selectDashboardNavigationResource", () => {
  test("prepares resources opened by extension presenters", async () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.layout.registerPanel({ id: "ticket", title: "Ticket", region: "main", rendererId: "ticket" });
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.resources.registerPresenter({
      id: "ticket",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource) => workbench.layout.openPanel("ticket", { resource }),
    });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    selectDashboardNavigationView(workbench, dashboardViews.sessions.id, { modeId: "project" });
    const ticket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/ticket-1",
      id: "ticket-1",
      label: "PS-1 Navigation",
    };

    prepareDashboardNavigationResource(workbench, ticket);
    await workbench.navigation.openTarget({ kind: "resource", resource: ticket });

    expect(getDashboardSelectedResource(workbench)).toBe(ticket);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["PS-1 Navigation"]);
  });

  test("does not replace dashboard navigation with an attached resource", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "artifact", label: "Artifact", surface: "attached" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const ticket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/ticket-1",
      id: "ticket-1",
      label: "PS-1 Navigation",
    };
    selectDashboardNavigationResource(workbench, ticket, { modeId: "project" });
    workbench.breadcrumbs.setItems([{ title: ticket.label }]);
    const scope = workbench.layout.getPersistenceScope();

    prepareDashboardNavigationResource(workbench, {
      kind: "artifact",
      uri: "dashboard-workbench://artifact/artifact-1",
      id: "artifact-1",
      label: "Artifact one",
    });

    expect(getDashboardSelectedResource(workbench)).toBe(ticket);
    expect(workbench.layout.getPersistenceScope()).toBe(scope);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["PS-1 Navigation"]);
  });

  test("preserves a preview Side Panel tab across same-project navigation scopes", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "workspace", label: "Workspace", activate: () => undefined });
    workbench.layout.registerPanel({
      id: "dashboard.session",
      title: "Session",
      region: "side",
      rendererId: "test.session",
    });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    selectDashboardNavigationView(workbench, dashboardViews.sessions.id, { modeId: "project" });

    const session = workbench.layout.openPanel("dashboard.session", {
      resource: {
        kind: "session",
        uri: "dashboard-workbench://session/session-1",
        id: "session-1",
        label: "Session one",
      },
    });

    selectDashboardNavigationResource(
      workbench,
      {
        kind: "workspace",
        uri: "dashboard-workbench://workspace/workspace-1",
        id: "workspace-1",
        label: "Workspace one",
      },
      { modeId: "workspace" },
    );
    selectDashboardNavigationView(workbench, dashboardViews.sessions.id, { modeId: "project" });

    expect(workbench.layout.listPanelInstances("side")).toEqual([
      expect.objectContaining({ instanceId: session.instanceId, tabRetention: "preview" }),
    ]);
  });
});

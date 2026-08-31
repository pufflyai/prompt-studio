import { describe, expect, test } from "bun:test";
import { getWorkbenchPageRegistryInternals } from "./registries/pages/page-registry-internals";
import { createWorkbenchCore } from "./workbench-core";

describe("workbench core pages", () => {
  test("leaves the layout untouched before a page project starts", () => {
    const workbench = createWorkbenchCore();

    expect(workbench.layout.getLayout().regions.main.visible).toBe(true);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(true);
  });

  test("rejects a malformed resource URI without throwing", () => {
    const workbench = createWorkbenchCore();

    expect(getWorkbenchPageRegistryInternals(workbench.pages).resources.fromUri("not a URI")).toBeUndefined();
  });

  test("renders a registered page through the shared page runtime", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.layout.registerPanel({ id: "tickets-panel", title: "Tickets", region: "main", rendererId: "test" });
    workbench.views.registerView({ id: "tickets-view", panelId: "tickets-panel" });
    workbench.pages.registerPage({
      id: "pstdio.planner.page.tickets",
      ref: { extensionId: "pstdio.planner", kind: "page", id: "tickets" },
      title: "Tickets",
      path: "tickets",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "tickets-view" }],
    });

    getWorkbenchPageRegistryInternals(workbench.pages).activateLocation({
      pageId: "pstdio.planner.page.tickets",
      projectId: "project-1",
      location: { page: { extensionId: "pstdio.planner", kind: "page", id: "tickets" } },
      action: "testOpenPage",
    });

    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({
        contributionId: "tickets-panel",
        placementIdentity: {
          kind: "page",
          pageId: "pstdio.planner.page.tickets",
          slotId: "content",
          instanceKey: "default",
        },
        role: "location",
        viewId: "tickets-view",
      }),
    ]);
  });

  test("updates renderer section input without opening a second resource placement", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.layout.registerPanel({ id: "ticket-panel", title: "Ticket", region: "main", rendererId: "test" });
    workbench.views.registerView({ id: "ticket-detail", panelId: "ticket-panel" });
    workbench.pages.registerPage({
      id: "pstdio.planner.page.ticket",
      ref: { extensionId: "pstdio.planner", kind: "page", id: "ticket" },
      title: "Ticket",
      path: "tickets/:id",
      modeId: "project",
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          binding: { resourceKind: "ticket", viewId: "ticket-detail" },
        },
      ],
    });
    const internals = getWorkbenchPageRegistryInternals(workbench.pages);
    const resource = { type: "ticket", id: "PS-326" };

    internals.activateLocation({
      pageId: "pstdio.planner.page.ticket",
      projectId: "project-1",
      resource,
      section: { anchors: [{ id: "summary", heading: "Summary" }] },
      location: {
        page: { extensionId: "pstdio.planner", kind: "page", id: "ticket" },
        resource,
        section: { anchors: [{ id: "summary", heading: "Summary" }] },
      },
      action: "testOpenTicketSummary",
    });
    internals.activateLocation({
      pageId: "pstdio.planner.page.ticket",
      projectId: "project-1",
      resource,
      section: { anchors: [{ id: "acceptance", heading: "Acceptance" }] },
      location: {
        page: { extensionId: "pstdio.planner", kind: "page", id: "ticket" },
        resource,
        section: { anchors: [{ id: "acceptance", heading: "Acceptance" }] },
      },
      action: "testOpenTicketAcceptance",
    });

    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({
        contributionId: "ticket-panel",
        section: { anchors: [{ id: "acceptance", heading: "Acceptance" }] },
      }),
    ]);
    expect(workbench.layout.getActivePanel("main")?.section).toEqual({
      anchors: [{ id: "acceptance", heading: "Acceptance" }],
    });
  });

  test("tracks module page registrations through the shared registry", () => {
    const workbench = createWorkbenchCore();
    const registration = workbench.registerModule({
      id: "pstdio.planner",
      activate: (context) =>
        context.pages.registerPage({
          id: "pstdio.planner.page.start",
          ref: { extensionId: "pstdio.planner", kind: "page", id: "start" },
          title: "Start",
          path: "start",
          modeId: "project",
          slots: [{ id: "content", role: "primary", region: "main", viewId: "start-view" }],
        }),
    });

    expect(workbench.pages.getPage("pstdio.planner.page.start")).toBeDefined();

    registration.dispose();
    expect(workbench.pages.getPage("pstdio.planner.page.start")).toBeUndefined();
  });

  test("reconciles live mode placement registration and disposal through its backing view", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.layout.registerPanel({ id: "sessions-panel", title: "Sessions", region: "side", rendererId: "test" });
    workbench.layout.registerPanel({ id: "tickets-panel", title: "Tickets", region: "main", rendererId: "test" });
    workbench.views.registerView({ id: "sessions-view", panelId: "sessions-panel" });
    workbench.views.registerView({ id: "tickets-view", panelId: "tickets-panel" });
    workbench.pages.registerPage({
      id: "pstdio.planner.page.tickets",
      ref: { extensionId: "pstdio.planner", kind: "page", id: "tickets" },
      title: "Tickets",
      path: "tickets",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "tickets-view" }],
    });
    getWorkbenchPageRegistryInternals(workbench.pages).activateLocation({
      pageId: "pstdio.planner.page.tickets",
      projectId: "project-1",
      location: { page: { extensionId: "pstdio.planner", kind: "page", id: "tickets" } },
      action: "testOpenPage",
    });

    const registration = workbench.modePlacements.registerPlacement({
      id: "pstdio.placement.sessions",
      ref: { extensionId: "pstdio", kind: "placement", id: "sessions" },
      modeId: "project",
      item: { kind: "view", viewId: "sessions-view" },
      region: "side",
    });
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({
        contributionId: "sessions-panel",
        viewId: "sessions-view",
        placementIdentity: {
          kind: "mode",
          modeId: "project",
          placementId: "pstdio.placement.sessions",
          instanceKey: "default",
        },
      }),
    ]);

    registration.dispose();
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([]);
  });

  test("rejects an unresolved mode placement before publishing it", () => {
    const workbench = createWorkbenchCore();

    expect(() =>
      workbench.modePlacements.registerPlacement({
        id: "pstdio.placement.missing",
        ref: { extensionId: "pstdio", kind: "placement", id: "missing" },
        modeId: "project",
        item: { kind: "view", viewId: "missing-view" },
        region: "side",
      }),
    ).toThrow("Workbench mode placement view is not registered: missing-view");
    expect(workbench.modePlacements.listPlacements()).toEqual([]);
  });
});

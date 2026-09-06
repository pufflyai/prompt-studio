import { describe, expect, test } from "bun:test";
import { registerResourcePage } from "./controllers/page-runtime/page-runtime-test-support";
import { getWorkbenchPageRegistryInternals } from "./registries/pages/page-registry-internals";
import { createWorkbench } from "./workbench-core";

const registerView = (
  workbench: ReturnType<typeof createWorkbench>,
  view: {
    id: string;
    title: string;
  },
) => workbench.views.registerView({ ...view, body: { kind: "react", render: () => null } });
describe("workbench core pages", () => {
  test("leaves the layout untouched before a page project starts", () => {
    const workbench = createWorkbench();
    expect(workbench.layout.getLayout().regions.main.visible).toBe(true);
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(true);
  });
  test("rejects a malformed resource URI without throwing", () => {
    const workbench = createWorkbench();
    expect(getWorkbenchPageRegistryInternals(workbench.pages).resources.fromUri("not a URI")).toBeUndefined();
  });
  test("renders a registered page through the shared page runtime", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registerView(workbench, { id: "tickets-view", title: "Tickets" });
    registerResourcePage(workbench, {
      id: "pstdio.planner.page.tickets",
      ref: { extensionId: "pstdio.planner", kind: "page", id: "tickets" },
      title: "Tickets",
      path: "tickets",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "tickets-view",
        },
        cardinality: "one",
      },
      slots: [],
    });
    getWorkbenchPageRegistryInternals(workbench.pages).activateLocation({
      pageId: "pstdio.planner.page.tickets",
      projectId: "project-1",
      location: { page: { extensionId: "pstdio.planner", kind: "page", id: "tickets" } },
      action: "testOpenPage",
    });
    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({
        contributionId: "workbench.page-placement.pstdio.planner.page.tickets.%24main",
        placementIdentity: {
          kind: "page",
          pageId: "pstdio.planner.page.tickets",
          slotId: "$main",
          instanceKey: "default",
        },
        role: "location",
        viewId: "tickets-view",
      }),
    ]);
  });
  test("updates renderer section input without opening a second resource placement", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registerView(workbench, { id: "ticket-detail", title: "Ticket" });
    registerResourcePage(workbench, {
      id: "pstdio.planner.page.ticket",
      ref: { extensionId: "pstdio.planner", kind: "page", id: "ticket" },
      title: "Ticket",
      path: "tickets/:id",
      modeId: "project",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "ticket",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "ticket-detail",
        },
        cardinality: "one",
      },
      slots: [],
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
        contributionId: "workbench.page-placement.pstdio.planner.page.ticket.%24main",
        section: { anchors: [{ id: "acceptance", heading: "Acceptance" }] },
      }),
    ]);
    expect(workbench.layout.getActivePanel("main")?.section).toEqual({
      anchors: [{ id: "acceptance", heading: "Acceptance" }],
    });
  });
  test("tracks module page registrations through the shared registry", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    const registration = workbench.registerModule({
      id: "pstdio.planner",
      activate: (context) => {
        context.views.registerView({
          id: "start-view",
          title: "Start",
          body: { kind: "react", render: () => null },
        });
        return context.pages.registerPage({
          id: "pstdio.planner.page.start",
          ref: { extensionId: "pstdio.planner", kind: "page", id: "start" },
          title: "Start",
          path: "start",
          modeId: "project",
          main: {
            kind: "view",
            view: {
              kind: "view",
              id: "start-view",
            },
            cardinality: "one",
          },
          slots: [],
        });
      },
    });
    expect(workbench.pages.getPage("pstdio.planner.page.start")).toBeDefined();
    registration.dispose();
    expect(workbench.pages.getPage("pstdio.planner.page.start")).toBeUndefined();
  });
  test("removes an active page while its persistence scope changes", () => {
    const workbench = createWorkbench({
      resolvePagePersistenceScope: ({ pageId, projectId }) => ({
        scope: projectId && pageId ? `${projectId}/${pageId}` : projectId,
      }),
    });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registerView(workbench, { id: "start-view", title: "Start" });
    registerView(workbench, { id: "lab-view", title: "Lab" });
    registerResourcePage(workbench, {
      id: "start",
      ref: { extensionId: "pstdio", kind: "page", id: "start" },
      title: "Start",
      path: "",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "start-view",
        },
        cardinality: "one",
      },
      slots: [],
    });
    const lab = registerResourcePage(workbench, {
      id: "lab",
      ref: { extensionId: "pstdio.lab", kind: "page", id: "lab" },
      title: "Lab",
      path: "lab",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "lab-view",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: { extensionId: "pstdio.lab", kind: "page", id: "lab" } });
    lab.dispose();
    expect(workbench.pages.getPage("lab")).toBeUndefined();
    expect(workbench.pages.store.getState().activePageId).toBe("start");
  });
});
describe("workbench core mode placement pages", () => {
  test("reconciles live mode placement registration and disposal through its backing view", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registerView(workbench, { id: "sessions-view", title: "Sessions" });
    registerView(workbench, { id: "tickets-view", title: "Tickets" });
    registerResourcePage(workbench, {
      id: "pstdio.planner.page.tickets",
      ref: { extensionId: "pstdio.planner", kind: "page", id: "tickets" },
      title: "Tickets",
      path: "tickets",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "tickets-view",
        },
        cardinality: "one",
      },
      slots: [],
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
      item: {
        kind: "view",
        presence: "open",
        view: {
          kind: "view",
          id: "sessions-view",
        },
      },
      region: "side",
    });
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({
        contributionId: "workbench.mode-placement.pstdio.placement.sessions",
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
  test("opens an explicit resource panel without replacing the active page", async () => {
    const workbench = createWorkbench({ initialSidePanelMode: "closed" });
    const projectPage = { extensionId: "pstdio.test", kind: "page" as const, id: "project" };
    const sessionsPage = { extensionId: "pstdio.test", kind: "page" as const, id: "sessions" };
    const sessionPanel = { extensionId: "pstdio.test", kind: "placement" as const, id: "session" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.modes.registerMode({ id: "sessions", activate: () => undefined });
    registerView(workbench, { id: "project-view", title: "Project" });
    registerView(workbench, { id: "sessions-view", title: "Sessions" });
    registerView(workbench, { id: "session-view", title: "Session" });
    registerResourcePage(workbench, {
      id: "test.project",
      ref: projectPage,
      title: "Project",
      path: "",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "project-view",
        },
        cardinality: "one",
      },
      slots: [],
    });
    registerResourcePage(workbench, {
      id: "test.sessions",
      ref: sessionsPage,
      title: "Sessions",
      path: "sessions",
      modeId: "sessions",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "sessions-view",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.modePlacements.registerPlacement({
      id: "test.session",
      ref: sessionPanel,
      modeId: "project",
      item: {
        kind: "binding",
        binding: {
          kinds: [
            {
              kind: "resource-kind",
              id: "session",
            },
          ],
          view: {
            kind: "view",
            id: "session-view",
          },
          cardinality: "many",
        },
      },
      region: "side",
    });
    workbench.pageLocations.setProject("project-1");
    await workbench.navigation.openTarget({ kind: "page", page: projectPage });
    await workbench.navigation.openTarget({
      kind: "panel",
      panel: sessionPanel,
      resource: { type: "session", id: "session-1", label: "Session one" },
      open: "preview",
    });
    expect(workbench.pages.store.getState().activePageId).toBe("test.project");
    expect(workbench.layout.getLayout().regions.main.widgets.map((item) => item.contributionId)).toEqual([
      "workbench.page-placement.test.project.%24main",
    ]);
    expect(workbench.layout.getLayout().regions.side.widgets[0]).toMatchObject({
      contributionId: "workbench.mode-placement.test.session",
      resource: { type: "session", id: "session-1" },
      tabRetention: "preview",
    });
    expect(workbench.sidePanel.getMode()).toBe("attached");
    await workbench.navigation.openTarget({ kind: "page", page: sessionsPage });
    expect(workbench.layout.getLayout().regions.main.widgets.map((item) => item.contributionId)).toEqual([
      "workbench.page-placement.test.sessions.%24main",
    ]);
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([]);
  });
  test("publishes the page mode before notifying primary-resource listeners", async () => {
    const workbench = createWorkbench();
    const page = { extensionId: "pstdio.test", kind: "page" as const, id: "ticket" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registerView(workbench, { id: "ticket", title: "Ticket" });
    registerResourcePage(workbench, {
      id: "test.ticket",
      ref: page,
      title: "Ticket",
      path: "ticket",
      modeId: "project",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "ticket",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "ticket",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    const observedModes: Array<string | undefined> = [];
    workbench.onDidChangePrimaryResource(() => observedModes.push(workbench.modes.getActiveModeId()));
    await workbench.navigation.openTarget({
      kind: "page",
      page,
      resource: { type: "ticket", id: "PS-1", label: "Ticket" },
    });
    expect(observedModes).toEqual(["project"]);
  });
});

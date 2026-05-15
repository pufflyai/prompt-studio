import { describe, expect, it } from "bun:test";
import { createDashboardShell, DASHBOARD_MODE_IDS } from "./dashboard-shell";
import { applyRouteActivation, resolveRouteActivation } from "./tanstack-shell-adapter";

describe("resolveRouteActivation", () => {
  it("activates dashboard.projects-list for the root and project list routes", () => {
    expect(resolveRouteActivation({ pathname: "/" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectsList,
      contextKeys: { projectId: undefined, ticketId: undefined, sessionId: undefined },
    });
    expect(resolveRouteActivation({ pathname: "/projects" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectsList,
      contextKeys: { projectId: undefined, ticketId: undefined, sessionId: undefined },
    });
    expect(resolveRouteActivation({ pathname: "/projects/" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectsList,
      contextKeys: { projectId: undefined, ticketId: undefined, sessionId: undefined },
    });
  });

  it("activates dashboard.settings for the global settings route", () => {
    expect(resolveRouteActivation({ pathname: "/settings" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.dashboardSettings,
      contextKeys: { projectId: undefined, ticketId: undefined, sessionId: undefined },
    });
  });

  it("activates project.navigation for tickets and ticket detail routes", () => {
    expect(resolveRouteActivation({ pathname: "/projects/p1/tickets" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectNavigation,
      contextKeys: { projectId: "p1", ticketId: undefined, sessionId: undefined },
    });
    expect(resolveRouteActivation({ pathname: "/projects/p1/tickets/PS-281" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectNavigation,
      contextKeys: { projectId: "p1", ticketId: "PS-281", sessionId: undefined },
    });
    expect(resolveRouteActivation({ pathname: "/projects/p1/tickets/PS-281/files/foo.md" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectNavigation,
      contextKeys: { projectId: "p1", ticketId: "PS-281", sessionId: undefined },
    });
  });

  it("activates project.navigation for extension routes", () => {
    expect(resolveRouteActivation({ pathname: "/projects/p1/extensions/foo" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectNavigation,
      contextKeys: { projectId: "p1", ticketId: undefined, sessionId: undefined },
    });
  });

  it("activates project.sessions for sessions routes", () => {
    expect(resolveRouteActivation({ pathname: "/projects/p1/sessions" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectSessions,
      contextKeys: { projectId: "p1", ticketId: undefined, sessionId: undefined },
    });
    expect(resolveRouteActivation({ pathname: "/projects/p1/sessions/s1" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectSessions,
      contextKeys: { projectId: "p1", ticketId: undefined, sessionId: "s1" },
    });
  });

  it("activates project.settings for project-scoped settings route", () => {
    expect(resolveRouteActivation({ pathname: "/projects/p1/settings" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectSettings,
      contextKeys: { projectId: "p1", ticketId: undefined, sessionId: undefined },
    });
  });

  it("falls back to project.navigation for unknown project subroutes (project index)", () => {
    expect(resolveRouteActivation({ pathname: "/projects/p1" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectNavigation,
      contextKeys: { projectId: "p1", ticketId: undefined, sessionId: undefined },
    });
    expect(resolveRouteActivation({ pathname: "/projects/p1/" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectNavigation,
      contextKeys: { projectId: "p1", ticketId: undefined, sessionId: undefined },
    });
  });

  it("falls back to projects-list for unknown top-level routes", () => {
    expect(resolveRouteActivation({ pathname: "/onboarding" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectsList,
      contextKeys: { projectId: undefined, ticketId: undefined, sessionId: undefined },
    });
    expect(resolveRouteActivation({ pathname: "/some/unknown/path" })).toEqual({
      modeId: DASHBOARD_MODE_IDS.projectsList,
      contextKeys: { projectId: undefined, ticketId: undefined, sessionId: undefined },
    });
  });
});

const createInMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

describe("applyRouteActivation", () => {
  it("sets the active mode and project context key on first apply", () => {
    const shell = createDashboardShell({ storage: createInMemoryStorage() });

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/p1/tickets" }));

    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectNavigation);
    expect(shell.context.get("projectId")).toBe("p1");
    expect(shell.context.get("ticketId")).toBeUndefined();
    expect(shell.context.get("sessionId")).toBeUndefined();
  });

  it("updates context keys without redundant setActiveMode when staying in the same mode", () => {
    const shell = createDashboardShell({ storage: createInMemoryStorage() });
    let modeChangeCount = 0;
    shell.modes.onDidChangeActive(() => {
      modeChangeCount += 1;
    });

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/p1/tickets" }));
    expect(modeChangeCount).toBe(1);

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/p1/tickets/PS-9" }));
    expect(modeChangeCount).toBe(1); // same mode, no change
    expect(shell.context.get("ticketId")).toBe("PS-9");
  });

  it("clears projectId and ticketId when navigating back to the project list", () => {
    const shell = createDashboardShell({ storage: createInMemoryStorage() });

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/p1/tickets/PS-9" }));
    expect(shell.context.get("projectId")).toBe("p1");
    expect(shell.context.get("ticketId")).toBe("PS-9");

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects" }));
    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectsList);
    expect(shell.context.get("projectId")).toBeUndefined();
    expect(shell.context.get("ticketId")).toBeUndefined();
  });

  it("switches modes when route category changes", () => {
    const shell = createDashboardShell({ storage: createInMemoryStorage() });

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/p1/tickets" }));
    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectNavigation);

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/p1/sessions/s1" }));
    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectSessions);
    expect(shell.context.get("projectId")).toBe("p1");
    expect(shell.context.get("sessionId")).toBe("s1");

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/p1/settings" }));
    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectSettings);
    expect(shell.context.get("projectId")).toBe("p1");
    expect(shell.context.get("sessionId")).toBeUndefined();
  });

  it("is idempotent: applying the same activation twice does not fire mode change", () => {
    const shell = createDashboardShell({ storage: createInMemoryStorage() });
    let modeChangeCount = 0;
    shell.modes.onDidChangeActive(() => {
      modeChangeCount += 1;
    });

    const activation = resolveRouteActivation({ pathname: "/projects/p1/sessions/s1" });
    applyRouteActivation(shell, activation);
    applyRouteActivation(shell, activation);

    expect(modeChangeCount).toBe(1);
    expect(shell.context.get("sessionId")).toBe("s1");
  });
});

describe("createDashboardShell", () => {
  it("registers all six unified-shell modes", () => {
    const shell = createDashboardShell({ storage: createInMemoryStorage() });

    const modeIds = shell.modes.listModes().map((mode) => mode.id);
    expect(modeIds).toContain(DASHBOARD_MODE_IDS.projectsList);
    expect(modeIds).toContain(DASHBOARD_MODE_IDS.dashboardSettings);
    expect(modeIds).toContain(DASHBOARD_MODE_IDS.dashboardWorkspaces);
    expect(modeIds).toContain(DASHBOARD_MODE_IDS.projectNavigation);
    expect(modeIds).toContain(DASHBOARD_MODE_IDS.projectSessions);
    expect(modeIds).toContain(DASHBOARD_MODE_IDS.projectSettings);
  });

  it("starts with no active mode (adapter is responsible for activation)", () => {
    const shell = createDashboardShell({ storage: createInMemoryStorage() });
    expect(shell.modes.getActiveModeId()).toBeUndefined();
  });

  it("disposes cleanly", () => {
    const shell = createDashboardShell({ storage: createInMemoryStorage() });
    expect(() => shell.dispose()).not.toThrow();
  });
});

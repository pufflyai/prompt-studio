import { describe, expect, it } from "bun:test";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "./workbench-core";

describe("workbench modules", () => {
  it("does not retain or assign focus to a closed region", () => {
    const workbench = createWorkbenchCore();

    workbench.focus.setActiveRegion("secondary");
    workbench.layout.setRegionVisible("secondary", false);

    expect(workbench.focus.getActiveRegion()).toBeUndefined();

    workbench.focus.setActiveRegion("main");
    workbench.focus.setActiveRegion("secondary");

    expect(workbench.focus.getActiveRegion()).toBe("main");

    workbench.layout.setRegionVisible("main", false);

    expect(workbench.focus.getActiveRegion()).toBeUndefined();
  });

  it("registers workbench modules through the workbench core API", () => {
    const workbench = createWorkbenchCore();
    const module: WorkbenchModuleContribution = {
      id: "dashboard.project",
      activate: (ctx) => {
        ctx.commands.registerCommand({ id: "project.open", label: "Open project" }, { execute: () => undefined });
      },
    };

    workbench.registerModule(module);

    expect(workbench.commands.getCommand("project.open")?.ownerId).toBe("dashboard.project");
    expect(workbench.commands.getCommand("project.open")?.source).toBe("module");
  });

  it("establishes a Location only when a resource presenter returns its Panel", async () => {
    const workbench = createWorkbenchCore();
    const ticketsResource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/tickets",
      label: "Tickets",
    };

    workbench.resources.registerKind({
      kind: "dashboard-view",
      label: "Dashboard view",
      surface: "primary",
    });
    workbench.layout.registerPanel({
      closable: false,
      id: "dashboard.tickets",
      title: "Tickets",
      region: "main",
      rendererId: "dashboard.tickets",
      resourceKinds: ["dashboard-view"],
    });
    workbench.resources.registerPresenter({
      id: "dashboard-view",
      canOpen: (resource) => resource.kind === "dashboard-view",
      open: (resource) => workbench.layout.openPanel("dashboard.tickets", { resource }),
    });

    workbench.layout.openPanel("dashboard.tickets", { resource: ticketsResource });
    expect(workbench.getPrimaryResource()).toBeUndefined();

    await workbench.resources.openResource(ticketsResource);
    expect(workbench.getPrimaryResource()).toEqual(ticketsResource);
  });

  it("scopes the primary resource to the main anchor, ignoring side-region activation", async () => {
    const workbench = createWorkbenchCore();
    const board = { kind: "dashboard-view", uri: "pstdio://dashboard/workspaces", label: "Workspaces" };
    const session = { kind: "session", uri: "pstdio://session/s1", label: "Session 1" };

    const primaryChanges: (string | undefined)[] = [];
    const globalChanges: (string | undefined)[] = [];

    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.layout.registerPanel({
      closable: false,
      id: "board",
      title: "Board",
      region: "main",
      rendererId: "board",
    });
    workbench.layout.registerWidget({ id: "session", title: "Session", region: "side", rendererId: "session" });
    workbench.resources.registerPresenter({
      id: "dashboard-view",
      canOpen: (resource) => resource.kind === "dashboard-view",
      open: (resource) => workbench.layout.openPanel("board", { resource }),
    });
    workbench.onDidChangePrimaryResource((resource) => primaryChanges.push(resource?.uri));
    workbench.onDidChangeActiveResource((resource) => globalChanges.push(resource?.uri));

    await workbench.resources.openResource(board);
    // Activating a side anchor moves the global signal but must NOT move primary.
    workbench.layout.openWidget("session", { resource: session });

    expect(workbench.getPrimaryResource()).toEqual(board);
    expect(workbench.getActiveResource()).toEqual(session);
    expect(primaryChanges).toEqual(["pstdio://dashboard/workspaces"]);
    expect(globalChanges).toEqual(["pstdio://dashboard/workspaces", "pstdio://session/s1"]);
  });

  it("persists the primary resource as lastResource, ignoring non-main activation", async () => {
    let stored: { kind: string; uri: string; label?: string } | undefined;
    const workbench = createWorkbenchCore({
      lastResourcePersistence: {
        getLastResource: () => stored,
        setLastResource: (resource) => {
          stored = resource;
        },
      },
    });
    const board = { kind: "dashboard-view", uri: "pstdio://dashboard/workspaces", label: "Workspaces" };
    const session = { kind: "session", uri: "pstdio://session/s1", label: "Session 1" };

    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.layout.registerPanel({
      closable: false,
      id: "board",
      title: "Board",
      region: "main",
      rendererId: "board",
    });
    workbench.layout.registerWidget({ id: "session", title: "Session", region: "side", rendererId: "session" });
    workbench.resources.registerPresenter({
      id: "dashboard-view",
      canOpen: (resource) => resource.kind === "dashboard-view",
      open: (resource) => workbench.layout.openPanel("board", { resource }),
    });

    await workbench.resources.openResource(board);
    expect(workbench.lastResource.get()).toEqual(board);

    // Activating a side anchor must NOT overwrite the restorable last (primary) resource.
    workbench.layout.openWidget("session", { resource: session });
    expect(workbench.lastResource.get()).toEqual(board);
  });

  it("disconnects a detached anchor when the primary leaves its scoped candidates", async () => {
    const workbench = createWorkbenchCore();
    const workspaceA = { kind: "workspace", uri: "pstdio://workspace/a" };
    const workspaceB = { kind: "workspace", uri: "pstdio://workspace/b" };
    const sessionA = { kind: "session", uri: "pstdio://session/a1" };

    workbench.resources.registerKind({ kind: "workspace", label: "Workspace", surface: "primary" });
    workbench.resources.registerKind({ kind: "session", label: "Session", surface: "attached" });
    // Sessions are scoped to workspace A only — this is what makes the default isInScope disconnect.
    workbench.resources.registerProvider({
      id: "sessions",
      kind: "session",
      list: (_query, context) => (context.primary?.uri === workspaceA.uri ? [{ resource: sessionA }] : []),
    });

    workbench.layout.registerPanel({
      closable: false,
      id: "workspace",
      title: "Workspace",
      region: "main",
      rendererId: "workspace",
    });
    workbench.layout.registerWidget({ id: "session", title: "Session", region: "side", rendererId: "session" });
    workbench.resources.registerPresenter({
      id: "workspace",
      canOpen: (resource) => resource.kind === "workspace",
      open: (resource) => workbench.layout.openPanel("workspace", { resource }),
    });

    await workbench.resources.openResource(workspaceA);
    workbench.layout.openWidget("session", { resource: sessionA });
    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);

    // Switch the primary to workspace B: session A is no longer a candidate → disconnect.
    await workbench.resources.openResource(workspaceB);
    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(0);
  });
});

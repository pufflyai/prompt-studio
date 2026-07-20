import { describe, expect, it } from "bun:test";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "./workbench-core";

describe("workbench modules", () => {
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

  it("derives the active resource from the active layout placement", () => {
    const workbench = createWorkbenchCore();
    const ticketsResource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/tickets",
      label: "Tickets",
    };
    const workspacesResource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/workspaces",
      label: "Workspaces",
    };
    const changes: (string | undefined)[] = [];

    workbench.layout.registerWidget({
      id: "dashboard.tickets",
      title: "Tickets",
      region: "main",
      rendererId: "dashboard.tickets",
    });
    workbench.layout.registerWidget({
      id: "dashboard.workspaces",
      title: "Workspaces",
      region: "main",
      rendererId: "dashboard.workspaces",
    });
    workbench.onDidChangeActiveResource((resource) => changes.push(resource?.uri));

    workbench.layout.openWidget("dashboard.tickets", { resource: ticketsResource });
    workbench.layout.openWidget("dashboard.workspaces", { resource: workspacesResource });
    workbench.layout.activateWidget("dashboard.tickets");

    expect(workbench.getActiveResource()).toEqual(ticketsResource);
    expect(changes).toEqual([
      "pstdio://dashboard/tickets",
      "pstdio://dashboard/workspaces",
      "pstdio://dashboard/tickets",
    ]);
  });

  it("scopes the primary resource to the main anchor, ignoring side-region activation", () => {
    const workbench = createWorkbenchCore();
    const board = { kind: "dashboard-view", uri: "pstdio://dashboard/workspaces", label: "Workspaces" };
    const session = { kind: "session", uri: "pstdio://session/s1", label: "Session 1" };

    const primaryChanges: (string | undefined)[] = [];
    const globalChanges: (string | undefined)[] = [];

    workbench.layout.registerWidget({ id: "board", title: "Board", region: "main", rendererId: "board" });
    workbench.layout.registerWidget({ id: "session", title: "Session", region: "side", rendererId: "session" });
    workbench.onDidChangePrimaryResource((resource) => primaryChanges.push(resource?.uri));
    workbench.onDidChangeActiveResource((resource) => globalChanges.push(resource?.uri));

    workbench.layout.openWidget("board", { resource: board });
    // Activating a side anchor moves the global signal but must NOT move primary.
    workbench.layout.openWidget("session", { resource: session });

    expect(workbench.getPrimaryResource()).toEqual(board);
    expect(workbench.getActiveResource()).toEqual(session);
    expect(primaryChanges).toEqual(["pstdio://dashboard/workspaces"]);
    expect(globalChanges).toEqual(["pstdio://dashboard/workspaces", "pstdio://session/s1"]);
  });

  it("persists the primary resource as lastResource, ignoring non-main activation", () => {
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

    workbench.layout.registerWidget({ id: "board", title: "Board", region: "main", rendererId: "board" });
    workbench.layout.registerWidget({ id: "session", title: "Session", region: "side", rendererId: "session" });

    workbench.layout.openWidget("board", { resource: board });
    expect(workbench.lastResource.get()).toEqual(board);

    // Activating a side anchor must NOT overwrite the restorable last (primary) resource.
    workbench.layout.openWidget("session", { resource: session });
    expect(workbench.lastResource.get()).toEqual(board);
  });

  it("disconnects a detached anchor when the primary leaves its scoped candidates", () => {
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

    workbench.layout.registerWidget({ id: "workspace", title: "Workspace", region: "main", rendererId: "workspace" });
    workbench.layout.registerWidget({ id: "session", title: "Session", region: "side", rendererId: "session" });

    workbench.layout.openWidget("workspace", { resource: workspaceA });
    workbench.layout.openWidget("session", { resource: sessionA });
    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);

    // Switch the primary to workspace B: session A is no longer a candidate → disconnect.
    workbench.layout.openWidget("workspace", { resource: workspaceB });
    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(0);
  });
});

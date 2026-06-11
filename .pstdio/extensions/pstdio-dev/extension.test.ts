import { describe, expect, test } from "bun:test";
import extension, { browserOpenCommand } from "./extension";

describe("pstdio dev extension", () => {
  test("opens the selected workspace worktree in VS Code", async () => {
    const spawned: unknown[] = [];

    await extension.commands?.["workspace.openInVscode"]?.run({
      params: {},
      resource: { type: "workspace", id: "workspace-1" },
      workspaces: {
        get: async () => ({ id: "workspace-1", worktree_path: "/repo/.worktrees/workspace-1" }),
      },
      process: {
        spawnDetached: async (input: unknown) => {
          spawned.push(input);
          return { pid: 123 };
        },
      },
    } as never);

    expect(extension.commands?.["workspace.openInVscode"]?.menus).toEqual([
      {
        target: "workbench.nav.overflow",
        label: "Open in VS Code",
        icon: "code",
        when: { resourceType: ["workspace"] },
      },
    ]);
    expect(spawned).toEqual([
      { command: ["code", "/repo/.worktrees/workspace-1"], cwd: "/repo/.worktrees/workspace-1" },
    ]);
  });

  test("opens the selected workspace through the isolated dev stack", async () => {
    const calls: unknown[] = [];

    const result = await extension.commands?.["workspace.openInIsolation"]?.run({
      params: {},
      resource: { type: "workspace", id: "workspace-1" },
      workspaces: {
        get: async () => ({ id: "workspace-1", worktree_path: "/repo/.worktrees/workspace-1" }),
      },
      process: {
        runOrThrow: async (input: unknown) => {
          calls.push({ kind: "run", input });
          return {
            exitCode: 0,
            stdout: "\nStack:     pstdio-workspace-1\nDashboard: http://localhost:49152/\n",
            stderr: "",
          };
        },
        spawnDetached: async (input: unknown) => {
          calls.push({ kind: "spawn", input });
          return { pid: 456 };
        },
      },
    } as never);

    expect(extension.commands?.["workspace.openInIsolation"]?.menus).toEqual([
      {
        target: "workbench.nav.overflow",
        label: "Open in isolation",
        icon: "container",
        when: { resourceType: ["workspace"] },
      },
    ]);
    expect(result).toEqual({
      dashboardUrl: "http://localhost:49152/",
      stackName: "pstdio-workspace-1",
      worktreePath: "/repo/.worktrees/workspace-1",
    });
    expect(calls).toEqual([
      {
        kind: "run",
        input: {
          command: ["bun", "run", "dev:isolated", "--", "--name", "pstdio-workspace-1"],
          cwd: "/repo/.worktrees/workspace-1",
        },
      },
      {
        kind: "spawn",
        input: {
          command: browserOpenCommand("http://localhost:49152/"),
          cwd: "/repo/.worktrees/workspace-1",
        },
      },
    ]);
  });

  test("stops the selected workspace isolated dev stack", async () => {
    const calls: unknown[] = [];

    const result = await extension.commands?.["workspace.stopIsolation"]?.run({
      params: {},
      resource: { type: "workspace", id: "workspace-1" },
      workspaces: {
        get: async () => ({ id: "workspace-1", worktree_path: "/repo/.worktrees/workspace-1" }),
      },
      process: {
        runOrThrow: async (input: unknown) => {
          calls.push(input);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    } as never);

    expect(extension.commands?.["workspace.stopIsolation"]?.menus).toEqual([
      {
        target: "workbench.nav.overflow",
        label: "Stop isolation",
        icon: "square",
        when: { resourceType: ["workspace"] },
      },
    ]);
    expect(result).toEqual({
      stackName: "pstdio-workspace-1",
      worktreePath: "/repo/.worktrees/workspace-1",
    });
    expect(calls).toEqual([
      {
        command: ["bun", "run", "dev:isolated", "--", "--name", "pstdio-workspace-1", "--down"],
        cwd: "/repo/.worktrees/workspace-1",
      },
    ]);
  });

  test("formats browser open commands for supported platforms", () => {
    expect(browserOpenCommand("http://localhost:49152/", "darwin")).toEqual(["open", "http://localhost:49152/"]);
    expect(browserOpenCommand("http://localhost:49152/", "linux")).toEqual(["xdg-open", "http://localhost:49152/"]);
    expect(browserOpenCommand("http://localhost:49152/", "win32")).toEqual([
      "cmd",
      "/c",
      "start",
      "",
      "http://localhost:49152/",
    ]);
  });
});

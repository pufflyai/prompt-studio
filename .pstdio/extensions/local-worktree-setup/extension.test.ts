import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("local worktree setup extension", () => {
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
      { target: "workbench.nav.actions", label: "Open in VS Code", when: { resourceType: ["workspace"] } },
    ]);
    expect(spawned).toEqual([
      { command: ["code", "/repo/.worktrees/workspace-1"], cwd: "/repo/.worktrees/workspace-1" },
    ]);
  });
});

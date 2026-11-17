import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { listRepoExtensionRoots } from "./repo-extension-roots";

const readyWorkspace = {
  execution_kind: "local" as const,
  provider_state: "ready" as const,
  initializing: false,
  setup_error: null,
};

describe("listRepoExtensionRoots", () => {
  test("lists one extension root per project folder", async () => {
    const roots = await listRepoExtensionRoots({
      projectService: { list: async () => [{ id: "project-a" }, { id: "project-b" }] },
      workspaceService: {
        getDefault: async (projectId) => ({
          ...readyWorkspace,
          root_path: projectId === "project-a" ? "/repos/alpha" : "/repos/beta",
        }),
      },
    });

    expect(roots).toEqual([
      {
        rootPath: join("/repos/alpha", ".pstdio", "extensions"),
        projects: [{ projectId: "project-a", repoPath: "/repos/alpha" }],
      },
      {
        rootPath: join("/repos/beta", ".pstdio", "extensions"),
        projects: [{ projectId: "project-b", repoPath: "/repos/beta" }],
      },
    ]);
  });

  test("groups a folder opened by several projects into one root", async () => {
    const roots = await listRepoExtensionRoots({
      projectService: { list: async () => [{ id: "project-b" }, { id: "project-a" }] },
      workspaceService: {
        getDefault: async () => ({ ...readyWorkspace, root_path: "/repos/shared" }),
      },
    });

    expect(roots).toEqual([
      {
        rootPath: join("/repos/shared", ".pstdio", "extensions"),
        projects: [
          { projectId: "project-a", repoPath: "/repos/shared" },
          { projectId: "project-b", repoPath: "/repos/shared" },
        ],
      },
    ]);
  });

  test("discovers a restored folder only after workspace setup is ready", async () => {
    const ready = { ...readyWorkspace, root_path: "/repos/attached" };
    const restored = { ...ready, root_path: "/repos/restored", initializing: true };
    const input = {
      projectService: { list: async () => [{ id: "attached" }, { id: "restored" }] },
      workspaceService: { getDefault: async (projectId: string) => (projectId === "restored" ? restored : ready) },
    };

    expect((await listRepoExtensionRoots(input)).flatMap(({ projects }) => projects)).toEqual([
      { projectId: "attached", repoPath: ready.root_path },
    ]);

    restored.initializing = false;
    expect((await listRepoExtensionRoots(input)).flatMap(({ projects }) => projects)).toEqual([
      { projectId: "attached", repoPath: ready.root_path },
      { projectId: "restored", repoPath: restored.root_path },
    ]);
  });
});

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { listRepoExtensionRoots } from "./repo-extension-roots";

describe("listRepoExtensionRoots", () => {
  test("lists one extension root per project folder", async () => {
    const roots = await listRepoExtensionRoots({
      projectService: { list: async () => [{ id: "project-a" }, { id: "project-b" }] },
      workspaceService: {
        getDefault: async (projectId) => ({ root_path: projectId === "project-a" ? "/repos/alpha" : "/repos/beta" }),
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
        getDefault: async () => ({
          id: "home",
          project_id: "project-1",
          root_path: "/repos/shared",
          execution_kind: "local",
          provider_id: "pstdio.root",
          provider_state: "ready",
        }),
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
});

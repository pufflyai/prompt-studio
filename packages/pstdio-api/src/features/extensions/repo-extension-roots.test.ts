import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { listLinkedRepoExtensionRoots } from "./repo-extension-roots";

describe("listLinkedRepoExtensionRoots", () => {
  test("lists one extension root per linked repo", async () => {
    const roots = await listLinkedRepoExtensionRoots({
      projectService: { list: async () => [{ id: "project-a" }, { id: "project-b" }] },
      workspaceService: {
        getDefault: async (projectId) => ({ root_path: projectId === "project-a" ? "/repos/alpha" : "/repos/beta" }),
      },
    });

    expect(roots).toEqual([
      {
        rootPath: join("/repos/alpha", ".pstdio", "extensions"),
        links: [{ projectId: "project-a", repoPath: "/repos/alpha" }],
      },
      {
        rootPath: join("/repos/beta", ".pstdio", "extensions"),
        links: [{ projectId: "project-b", repoPath: "/repos/beta" }],
      },
    ]);
  });

  test("groups a repo shared by multiple projects into a single root with every link", async () => {
    const roots = await listLinkedRepoExtensionRoots({
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
        links: [
          { projectId: "project-a", repoPath: "/repos/shared" },
          { projectId: "project-b", repoPath: "/repos/shared" },
        ],
      },
    ]);
  });
});

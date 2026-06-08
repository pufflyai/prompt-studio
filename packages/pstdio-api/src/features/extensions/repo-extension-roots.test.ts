import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { listLinkedRepoExtensionRoots } from "./repo-extension-roots";

describe("listLinkedRepoExtensionRoots", () => {
  test("lists one extension root per linked repo", async () => {
    const roots = await listLinkedRepoExtensionRoots({
      projectService: { list: async () => [{ id: "project-a" }, { id: "project-b" }] },
      repoService: {
        listByProject: async (projectId) =>
          projectId === "project-a" ? [{ path: "/repos/alpha" }] : [{ path: "/repos/beta" }],
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
      repoService: { listByProject: async () => [{ path: "/repos/shared" }] },
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

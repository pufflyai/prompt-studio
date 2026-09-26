import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInvocationScope } from "pstdio-extensions";
import { createCommandEnvironment } from "./index";
import { createSessionsApi } from "./sessions";
import { createWorkspacesApi } from "./workspaces";

test("cancelling scoped reads leaves artifact, repo and extension saves independent", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-scoped-save-"));
  const controller = new AbortController();
  const repo = Promise.withResolvers<{ id: string; path: string }[]>();
  const environment = createCommandEnvironment(
    { repoService: { listByProject: () => repo.promise } } as never,
    [
      {
        instance: { id: "instance" },
        installedSource: { id: "source", extension_id: "test.example", source_path: root },
      },
    ] as never,
    {
      extensionId: "test.example",
      name: "example",
      projectId: "p",
      project: { id: "p", name: "Project", shorthand: "P" },
      repo: { projectId: "p", repoId: "repo", path: root },
      artifactMounts: [
        {
          extensionId: "test.example",
          localId: "docs",
          id: "test.example.docs",
          name: "example",
          relativePath: "docs",
        },
      ] as never,
    },
  );
  try {
    const scope = environment.withScope!(createInvocationScope({ parent: controller.signal, logger: console }));
    const mounts = [scope.artifacts.mount("docs"), scope.repoFiles!, scope.extensionFiles!];
    const saves = mounts.map((mount) => mount.writeText("draft.md", "Saved draft"));
    controller.abort();
    repo.resolve([{ id: "repo", path: root }]);
    const results = await Promise.allSettled(saves);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
    for (const path of [
      ".pstdio/extension-storage/example/docs/draft.md",
      "draft.md",
      ".pstdio/ext/test.example/draft.md",
    ]) {
      expect(await readFile(join(root, path), "utf8")).toBe("Saved draft");
    }
    for (const mount of mounts) await expect(mount.readText("draft.md")).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("anchor edits keep their project checks after a reader is cancelled", async () => {
  const controller = new AbortController();
  controller.abort();
  const writes: string[] = [];
  const service = (kind: string) => ({
    get: async (id: string) => ({ id, project_id: id === "foreign" ? "other" : "p" }),
    addAnchors: async () => {
      writes.push(`${kind}:add`);
    },
    removeAnchors: async () => {
      writes.push(`${kind}:remove`);
    },
  });
  const deps = { sessionService: service("session"), workspaceService: service("workspace") } as never;
  const sessions = createSessionsApi(deps, { projectId: "p", project: {} as never, signal: controller.signal });
  const workspaces = createWorkspacesApi(deps, { projectId: "p", signal: controller.signal }, {} as never);
  for (const api of [sessions, workspaces]) {
    await api.addAnchors("own", []);
    await api.removeAnchors("own", []);
    await expect(api.addAnchors("foreign", [])).rejects.toThrow("not found");
    await expect(api.get("own")).rejects.toThrow();
  }
  expect(writes).toEqual(["session:add", "session:remove", "workspace:add", "workspace:remove"]);
});

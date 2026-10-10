import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInvocationScope } from "pstdio-extensions";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createArtifactMountWriteLedger } from "../artifact-mount-watch/write-ledger";
import { createCommandEnvironment } from "./index";
import { createSessionsApi } from "./sessions";
import { createWorkspacesApi } from "./workspaces";

test("cancelling scoped reads leaves artifact, project and extension saves independent", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-scoped-save-"));
  const controller = new AbortController();
  const workspace = Promise.withResolvers<Record<string, unknown>>();
  const environment = createCommandEnvironment(
    {
      artifactMountWrites: createArtifactMountWriteLedger(),
      workspaceService: { getDefault: () => workspace.promise },
    } as never,
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
    const mounts = [scope.artifacts.mount("docs"), scope.projectFiles!, scope.extensionFiles!];
    const saves = mounts.map((mount) => mount.writeText("draft.md", "Saved draft"));
    controller.abort();
    workspace.resolve({
      id: "home",
      project_id: "p",
      root_path: root,
      execution_kind: "local",
      provider_state: "ready",
      provider_capabilities_json: { files: "write" },
    });
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
  const app = await createTestApp();
  const controller = new AbortController();
  controller.abort();
  try {
    const project = await app.deps.projectService.create({ name: "Own project" });
    const other = await app.deps.projectService.create({ name: "Other project" });
    const session = await app.deps.sessionService.create({ project_id: project.id, title: "Own", agent: "test" });
    const foreignSession = await app.deps.sessionService.create({
      project_id: other.id,
      title: "Foreign",
      agent: "test",
    });
    const workspace = await app.deps.workspaceService.createStandalone({ project_id: project.id });
    const foreignWorkspace = await app.deps.workspaceService.createStandalone({ project_id: other.id });
    const sessions = createSessionsApi(app.deps, { projectId: project.id, project, signal: controller.signal });
    const workspaces = createWorkspacesApi(app.deps, { projectId: project.id, signal: controller.signal }, {} as never);
    const anchor = { type: "project", id: project.id, extensionId: "pstdio" };
    for (const [api, service, ownId, foreignId] of [
      [sessions, app.deps.sessionService, session.id, foreignSession.id],
      [workspaces, app.deps.workspaceService, workspace.id, foreignWorkspace.id],
    ] as const) {
      await api.addAnchors(ownId, [anchor]);
      expect((await service.get(ownId))?.anchors_json).toEqual([anchor]);
      await api.removeAnchors(ownId, [anchor]);
      expect((await service.get(ownId))?.anchors_json).toEqual([]);
      await expect(api.addAnchors(foreignId, [anchor])).rejects.toThrow("not found");
      await expect(api.removeAnchors(foreignId, [anchor])).rejects.toThrow("not found");
      await expect(api.get(ownId)).rejects.toThrow();
    }
  } finally {
    await app.close();
  }
});

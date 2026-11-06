import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { nativeDocumentSourceSchema } from "pstdio-api-contracts";
import { createWorkspaceFileMount } from "../../features/extensions/command-environment/workspace-files";
import { createWorkspaceContextFixture } from "../../features/extensions/workspace-context.test-fixture";
import { withStorageObservation } from "../shared-files/storage-observation";
import { loadNativeMarkdownFile, saveNativeMarkdownFile } from "./file-source";
import { resolveNativeLoadedSource } from "./source-binding";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
});
afterEach(async () => fixture.cleanup());

test("native workspace documents bind the selected workspace without aliasing project files", async () => {
  const root = join(fixture.root, "worktree");
  await mkdir(root);
  await writeFile(join(root, "notes.txt"), "worktree edit");
  const worktree = { ...fixture.workspace, id: "ws-2", is_default: false, root_path: root };
  fixture.deps.workspaceService.get = async () => worktree;
  const source = nativeDocumentSourceSchema.parse({ kind: "workspace", workspaceId: worktree.id, path: "notes.txt" });
  const read = await withStorageObservation({}, () => createWorkspaceFileMount(async () => root).readText("notes.txt"));
  const owner = { workbenchId: "project-1", extensionId: "example.context" };
  const selected = await resolveNativeLoadedSource(fixture.deps, {
    owner,
    source,
    content: read.value,
    versions: read.versions,
  });
  const projectRead = await withStorageObservation({}, () =>
    createWorkspaceFileMount(async () => fixture.root).readText("notes.txt"),
  );
  const project = await resolveNativeLoadedSource(fixture.deps, {
    owner,
    source: { kind: "workspace", path: "notes.txt" },
    content: projectRead.value,
    versions: projectRead.versions,
  });
  expect(selected.copy?.content).toBe("worktree edit");
  expect(project.copy?.content).toBe("selected folder");
  expect(selected.documentKey).not.toBe(project.documentKey);
  await expect(
    resolveNativeLoadedSource(fixture.deps, {
      owner: { ...owner, workbenchId: "other-project" },
      source,
      content: read.value,
      versions: read.versions,
    }),
  ).rejects.toMatchObject({ code: "native_document_source_unavailable" });
  worktree.provider_capabilities_json.files = "none";
  await expect(
    resolveNativeLoadedSource(fixture.deps, { owner, source, content: read.value, versions: read.versions }),
  ).rejects.toMatchObject({ code: "native_document_source_unavailable" });
});

test("a scoped text provider resolves and saves the selected worktree with stale-write protection", async () => {
  const root = join(fixture.root, "worktree");
  await mkdir(root);
  await writeFile(join(root, "notes.txt"), "\ufeffworktree\r\n");
  const worktree = { ...fixture.workspace, id: "ws-2", is_default: false, root_path: root };
  fixture.deps.workspaceService.get = async (id) => (id === worktree.id ? worktree : fixture.workspace);
  await Bun.write(
    join(fixture.root, "extension.ts"),
    `export default { textSources: [{
    id: "body", ref: { kind: "text-source", id: "body" }, params: { workspaceId: { type: "text", required: true } },
    resolve: async (ctx, { params }) => ({ source: { kind: "workspace", workspaceId: params.workspaceId, path: "notes.txt" }, content: (await ctx.workspaces.readFile(params.workspaceId, "notes.txt")).content, editable: true }),
    project: async (ctx, { params, content }) => ctx.workspaces.writeFile(params.workspaceId, "notes.txt", { content }),
  }] };`,
  );
  const target = {
    projectId: "project-1",
    extensionId: "example.context",
    textDocument: { sourceId: "body", params: { workspaceId: worktree.id } },
  };
  const loaded = await loadNativeMarkdownFile(fixture.deps, target);
  expect(loaded.content.content).toBe("\ufeffworktree\r\n");
  const project = await loadNativeMarkdownFile(fixture.deps, {
    ...target,
    textDocument: { ...target.textDocument, params: { workspaceId: fixture.workspace.id } },
  });
  expect(project.content.content).toBe("selected folder");
  expect(loaded.documentKey).not.toBe(project.documentKey);
  await saveNativeMarkdownFile(fixture.deps, {
    ...target,
    content: "saved worktree",
    fileStorageVersions: loaded.fileStorageVersions,
  });
  expect(await readFile(join(root, "notes.txt"), "utf8")).toBe("saved worktree");
  expect(await readFile(join(fixture.root, "notes.txt"), "utf8")).toBe("selected folder");
  const refreshed = await loadNativeMarkdownFile(fixture.deps, target);
  await writeFile(join(root, "notes.txt"), "external edit");
  await expect(
    saveNativeMarkdownFile(fixture.deps, {
      ...target,
      content: "stale",
      fileStorageVersions: refreshed.fileStorageVersions,
    }),
  ).rejects.toThrow("changed since it was loaded");
  expect(await readFile(join(root, "notes.txt"), "utf8")).toBe("external edit");
});

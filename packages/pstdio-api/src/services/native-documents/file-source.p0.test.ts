import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createNativeSourceKey } from "pstdio-api-contracts";
import type { JsonObject } from "pstdio-api-contracts/extension-kernel";
import { createWorkspaceContextFixture } from "../../features/extensions/workspace-context.test-fixture";
import { loadNativeMarkdownFile, saveNativeMarkdownFile } from "./file-source";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
  await Bun.write(
    join(fixture.root, "extension.ts"),
    `export default { views: [{
    id: "document", ref: { kind: "view", id: "document" }, title: "Document",
    body: { kind: "file",
      async load(ctx, params) {
        await ctx.storage.set("renderer", params.renderer);
        const metadata = params.renderer.resource?.metadata ?? {};
        return { documentSource: metadata.unbound ? undefined : { kind: "workspace", path: "notes.txt" }, content: metadata.content ?? await ctx.workspaceFiles.readText("notes.txt"),
          fileName: metadata.fileName ?? "notes.md", editable: metadata.editable,
          textRenderer: metadata.textRenderer, mimeType: metadata.mimeType, emptyState: metadata.emptyState };
      },
      async save(ctx, params) {
        await ctx.storage.set("savedRenderer", params.renderer);
        await ctx.workspaceFiles.writeText("notes.txt", params.content);
        return { revision: "file-save-revision" };
      },
    },
  }, { id: "read-only", ref: { kind: "view", id: "read-only" }, title: "Read only",
    body: { kind: "file", load: async () => ({ fileName: "read.md", content: "Read only" }) },
  }] };`,
  );
});
afterEach(async () => {
  await fixture.cleanup();
});

const target = {
  fileRendererId: "example.context.view.document",
  resource: { extensionId: "example.context", projectId: "project-1", type: "document", id: "one" },
  pageParams: { section: "body" },
};

test("native Markdown uses the declared load handler and the source identity shared by its views", async () => {
  const file = await loadNativeMarkdownFile(fixture.deps, { ...target, projectId: "project-1" });
  expect(file.owner).toEqual({ workbenchId: "project-1", extensionId: "example.context" });
  expect(file.documentKey).toBe(createNativeSourceKey(["workspace", "notes.txt"]));
  expect(file.content.content).toBe("selected folder");
  expect(file.saveHandlerId).toBe("example.context.view.document.file.save");
  expect(fixture.values.get("renderer")).toMatchObject({
    rendererId: target.fileRendererId,
    projectId: "project-1",
    resource: target.resource,
    pageParams: target.pageParams,
  });
});

test("native Markdown saves through the declared handler with its original renderer context", async () => {
  await saveNativeMarkdownFile(fixture.deps, {
    ...target,
    projectId: "project-1",
    content: "Saved shared source",
    fileStorageVersions: {},
  });
  expect(await readFile(join(fixture.root, "notes.txt"), "utf8")).toBe("Saved shared source");
  expect(fixture.values.get("savedRenderer")).toMatchObject({
    rendererId: target.fileRendererId,
    projectId: "project-1",
    resource: target.resource,
    pageParams: target.pageParams,
  });
});

test("a native save preserves workspace file bytes changed after its load", async () => {
  const loaded = await loadNativeMarkdownFile(fixture.deps, { ...target, projectId: "project-1" });
  await writeFile(join(fixture.root, "notes.txt"), "outside edit");
  await expect(
    saveNativeMarkdownFile(fixture.deps, {
      ...target,
      projectId: "project-1",
      content: "stale editor text",
      fileStorageVersions: loaded.fileStorageVersions,
    }),
  ).rejects.toThrow("changed since it was loaded");
  expect(await readFile(join(fixture.root, "notes.txt"), "utf8")).toBe("outside edit");
});

test("native Markdown declines read-only, Monaco, code and image views", async () => {
  const cases: JsonObject[] = [
    { unbound: true },
    { editable: false },
    { textRenderer: "monaco" },
    { fileName: "code.ts" },
    { fileName: "image.png" },
    { mimeType: "image/svg+xml" },
    { emptyState: { title: "Select a file" } },
  ];
  for (const metadata of cases)
    await expect(
      loadNativeMarkdownFile(fixture.deps, {
        ...target,
        projectId: "project-1",
        resource: { ...target.resource, metadata },
      }),
    ).rejects.toMatchObject({ code: "native_document_not_editable" });
});

test("a missing view cannot create a native document by guessing an identity", async () => {
  await expect(
    loadNativeMarkdownFile(fixture.deps, { ...target, projectId: "project-1", fileRendererId: "missing.view" }),
  ).rejects.toMatchObject({ code: "native_document_view_unavailable" });
});

test("a file view without a save handler cannot create an editable native document", async () => {
  await expect(
    loadNativeMarkdownFile(fixture.deps, {
      projectId: "project-1",
      fileRendererId: "example.context.view.read-only",
      resource: undefined,
    }),
  ).rejects.toMatchObject({ code: "native_document_not_editable" });
});

test("invalid extension file content is rejected before document seeding", async () => {
  await expect(
    loadNativeMarkdownFile(fixture.deps, {
      ...target,
      projectId: "project-1",
      resource: { ...target.resource, metadata: { content: 42 } },
    }),
  ).rejects.toMatchObject({ code: "native_document_load_failed" });
});

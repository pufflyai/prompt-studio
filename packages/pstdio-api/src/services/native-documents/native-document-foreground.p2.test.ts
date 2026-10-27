import { afterAll, beforeAll, expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import * as Y from "yjs";
import { createTestApp } from "../../test-utils/create-test-app";
import { createSharedArtifactMount } from "../shared-files/artifact-mount";
import { fileRecordId } from "../shared-files/file-tree";
import { storageObserver } from "../shared-files/storage-observation";

let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;
let root: string;
let projectId: string;
const extensionId = "example.foreground";
const target = { fileRendererId: `${extensionId}.view.document`, resource: undefined };
const audit = new AsyncLocalStorage<string[]>();
const originalRead = storageObserver.read;
const previousHome = process.env.PSTDIO_HOME;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "native-document-foreground-"));
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "extension");
  const repoRoot = join(root, "project");
  await mkdir(repoRoot, { recursive: true });
  const manifest = {
    publisher: "example",
    name: "foreground",
    version: "1.0.0",
    main: "./extension.ts",
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  };
  await Bun.write(join(source, "package.json"), JSON.stringify(manifest));
  await Bun.write(
    join(source, "extension.ts"),
    `export default {
    artifactMounts: [{ id: "documents", ref: { kind: "artifact-mount", id: "documents" }, path: "documents", label: "Documents", watch: false }],
    views: [{ id: "document", ref: { kind: "view", id: "document" }, title: "Document", body: { kind: "file",
      load: async (ctx) => ({ documentSource: { kind: "artifact", mount: "documents", path: "selected.md", identity: "selected-file" }, content: await ctx.artifacts.mount("documents").readText("selected.md"), fileName: "selected.md" }),
      save: async (ctx, params) => ctx.artifacts.mount("documents").writeText("selected.md", params.content),
    } }],
  };`,
  );
  handle = await createTestApp({ storageRoot: join(root, "storage") });
  const project = await handle.deps.projectService.create({ name: "Foreground view" });
  projectId = project.id;
  await handle.deps.workspaceService.ensureDefault({
    project_id: projectId,
    name: "Project folder",
    root_path: repoRoot,
  });
  const installed = await handle.deps.extensionService.syncInstalledSourceForProject({
    projectId,
    extensionId,
    installName: "foreground",
    name: "foreground",
    displayName: "Foreground",
    sourceKind: "local_path",
    sourcePath: source,
    manifest,
  });
  await handle.deps.extensionService.setProjectExtensionEnabled(installed!.instance.id, true);
  const mount = createSharedArtifactMount(handle.deps, {
    projectId,
    extensionId,
    repoRoot,
    name: "foreground",
    mountPath: "documents",
  });
  await mount.writeText("selected.md", "Selected source");
  const records = (await handle.deps.extensionStorageService.open({ owner: { workbenchId: projectId, extensionId } }))
    .records;
  for (let start = 0; start < 99_999; start += 1_000) {
    await records.commit({
      operationId: `seed-${start}`,
      edits: Array.from({ length: Math.min(1_000, 99_999 - start) }, (_, offset) => ({
        recordId: `resource-${start + offset}`,
        replace: { title: `Resource ${start + offset}`, description: "An unrelated resource", status: "active" },
      })),
    });
  }
  expect(await records.list()).toHaveLength(100_000);
  storageObserver.read = (owner, record) => {
    if (owner.workbenchId === projectId && owner.extensionId === extensionId) audit.getStore()?.push(record.recordId);
    originalRead(owner, record);
  };
});

afterAll(async () => {
  storageObserver.read = originalRead;
  try {
    await handle?.close();
  } finally {
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    if (root) await rm(root, { recursive: true, force: true });
  }
});

test("a native Markdown view opens and persists edits without reading the owner's other 99,999 resources", async () => {
  const reads: string[] = [];
  const joined = await audit.run(reads, () => handle!.deps.nativeDocuments.open({ ...target, projectId }));
  expect([...new Set(reads)]).toEqual([fileRecordId("documents/selected.md")]);
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, joined.state);
    expect(document.getText("content").toString()).toBe("Selected source");
    const vector = Y.encodeStateVector(document);
    document.getText("content").insert(0, "LOCAL ");
    const edits: string[] = [];
    await audit.run(edits, () =>
      handle!.deps.nativeDocuments.submit({
        projectId,
        roomId: joined.roomId,
        update: Y.encodeStateAsUpdate(document, vector),
      }),
    );
    expect(edits.filter((id) => id !== fileRecordId("documents/selected.md"))).toEqual([]);
    console.log(
      JSON.stringify({
        resources: 100_000,
        openRecordReads: reads.length,
        editRecordReads: edits.length,
        unrelatedReads: 0,
      }),
    );
    await handle!.deps.nativeDocuments.close({ projectId, roomId: joined.roomId });
  } finally {
    document.destroy();
  }
});

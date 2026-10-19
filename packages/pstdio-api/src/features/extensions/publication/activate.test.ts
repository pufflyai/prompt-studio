import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { activatePublication } from "./activate";
import { openPublishedCatalog, publishedOwner } from "./catalog";
import { packExtension } from "./package";

let app: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "published-activation-"));
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
  await rm(root, { recursive: true, force: true });
});

const stage = async (projectId: string, source: string) => {
  const asset = await app.deps.assetTransferService.stage(
    publishedOwner(projectId),
    crypto.randomUUID(),
    await packExtension(source),
  );
  const catalog = await openPublishedCatalog(app.deps, projectId);
  const record = await catalog.records.read("test.unrelated");
  await catalog.records.commit({
    operationId: crypto.randomUUID(),
    edits: [
      {
        recordId: "test.unrelated",
        expectedRevision: record.revision,
        asset,
        replace: { extensionId: "test.unrelated", revision: asset.sha256, automation: false, enabled: true },
      },
    ],
  });
  return {
    asset,
    publication: { extensionId: "test.unrelated", revision: asset.sha256, automation: false, enabled: true },
  };
};
const installed = async (projectId: string) =>
  (await app.deps.extensionService.listProjectExtensionInstances(projectId))[0];

test("verified revisions retain instance data and personal enable choices; failed activation keeps the usable package", async () => {
  const project = await app.deps.projectService.create({ name: "Receiver" });
  const source = createTestExtensionSource({
    root,
    installName: "unrelated",
    name: "unrelated",
    displayName: "Unrelated",
  });
  await writeFile(join(source, "payload.bin"), new Uint8Array([0, 255, 17]));
  const first = await stage(project.id, source);
  expect(await activatePublication(app.deps, project.id, first.publication, first.asset)).toBe("active");
  const previous = await installed(project.id);
  expect(await readFile(join(previous.installedSource.source_path, "payload.bin"))).toEqual(Buffer.from([0, 255, 17]));
  const scope = { extension_instance_id: previous.instance.id, scope_type: "project", scope_id: project.id };
  await app.deps.extensionStorageService.setKv({ ...scope, key: "saved", value_json: { keep: true } });
  await app.deps.extensionService.setProjectExtensionEnabled(previous.instance.id, false);
  await writeFile(join(source, "extension.ts"), "throw new Error('invalid publication'); export default {};");
  const broken = await stage(project.id, source);
  await expect(
    activatePublication(app.deps, project.id, { ...broken.publication, automation: true, enabled: true }, broken.asset),
  ).rejects.toThrow();
  expect((await installed(project.id)).instance.enabled).toBe(false);
  expect((await installed(project.id)).installedSource.source_path).toBe(previous.installedSource.source_path);
  expect(await readFile(join(previous.installedSource.source_path, "extension.ts"), "utf8")).toContain(
    "export default {}",
  );
  const absent = { ...first.asset, sha256: "f".repeat(64) };
  await expect(
    activatePublication(app.deps, project.id, { ...first.publication, revision: absent.sha256 }, absent),
  ).rejects.toThrow();
  expect((await installed(project.id)).installedSource.source_path).toBe(previous.installedSource.source_path);
  await writeFile(join(source, "extension.ts"), "export default {commands: []};");
  const next = await stage(project.id, source);
  await activatePublication(app.deps, project.id, next.publication, next.asset);
  const updated = await installed(project.id);
  expect(updated.instance.id).toBe(previous.instance.id);
  expect(updated.instance.enabled).toBe(false);
  expect(updated.installedSource.loaded_revision).toBe(next.asset.sha256);
  expect((await app.deps.extensionStorageService.getKv(scope, "saved"))?.value_json).toEqual({ keep: true });
  await activatePublication(app.deps, project.id, first.publication, first.asset);
  expect((await installed(project.id)).installedSource.loaded_revision).toBe(first.asset.sha256);
  expect((await app.deps.extensionStorageService.getKv(scope, "saved"))?.value_json).toEqual({ keep: true });
});

test("unpublished edits remain private overrides until explicit adoption", async () => {
  const project = await app.deps.projectService.create({ name: "Override" });
  const source = createTestExtensionSource({
    root,
    installName: "override",
    name: "unrelated",
    displayName: "Unrelated",
  });
  const first = await stage(project.id, source);
  await activatePublication(app.deps, project.id, first.publication, first.asset);
  const previous = await installed(project.id);
  await writeFile(join(previous.installedSource.source_path, "local.txt"), "private draft");
  await app.deps.extensionService.reloadInstalledSourceBySourcePath(previous.installedSource.source_path);
  await writeFile(join(source, "new.txt"), "published update");
  const next = await stage(project.id, source);
  expect(await activatePublication(app.deps, project.id, next.publication, next.asset)).toBe("local-override");
  expect((await installed(project.id)).installedSource.source_path).toBe(previous.installedSource.source_path);
  await activatePublication(app.deps, project.id, next.publication, next.asset, undefined, true);
  expect((await installed(project.id)).installedSource.loaded_revision).toBe(next.asset.sha256);
  expect(await readFile(join(previous.installedSource.source_path, "local.txt"), "utf8")).toBe("private draft");
});

test("automation extension enable state follows the accepted workbench switch", async () => {
  const project = await app.deps.projectService.create({ name: "Automation" });
  const source = createTestExtensionSource({
    root,
    installName: "automation",
    name: "unrelated",
    displayName: "Unrelated",
  });
  const first = await stage(project.id, source);
  await activatePublication(
    app.deps,
    project.id,
    { ...first.publication, automation: true, enabled: false },
    first.asset,
  );
  const previous = await installed(project.id);
  expect(previous.instance.enabled).toBe(false);
  await activatePublication(
    app.deps,
    project.id,
    { ...first.publication, automation: true, enabled: true },
    first.asset,
  );
  expect((await installed(project.id)).instance.enabled).toBe(true);
});

test("concurrent catch-up installs one instance for an extension", async () => {
  const project = await app.deps.projectService.create({ name: "Concurrent receiver" });
  const source = createTestExtensionSource({
    root,
    installName: "concurrent",
    name: "unrelated",
    displayName: "Unrelated",
  });
  const first = await stage(project.id, source);
  await Promise.all([
    activatePublication(app.deps, project.id, first.publication, first.asset),
    activatePublication(app.deps, project.id, first.publication, first.asset),
  ]);
  expect(await app.deps.extensionService.listProjectExtensionInstances(project.id)).toHaveLength(1);
});

test("a personal enable choice made while preparing a revision is retained", async () => {
  const project = await app.deps.projectService.create({ name: "Concurrent choice" });
  const source = createTestExtensionSource({
    root,
    installName: "choice",
    name: "unrelated",
    displayName: "Unrelated",
  });
  const first = await stage(project.id, source);
  await activatePublication(app.deps, project.id, first.publication, first.asset);
  const previous = await installed(project.id);
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: app.app.fetch });
  try {
    const url = `${server.url.origin}/v1/projects/${project.id}/extensions/${previous.instance.id}`;
    await writeFile(
      join(source, "extension.ts"),
      `await fetch(${JSON.stringify(url)}, {method: "PATCH", headers: {"content-type":"application/json"}, body:'{"enabled":false}'}); export default {};`,
    );
    const next = await stage(project.id, source);
    await activatePublication(app.deps, project.id, next.publication, next.asset);
    expect((await installed(project.id)).instance.enabled).toBe(false);
    expect((await installed(project.id)).installedSource.source_ref).toBe(`pstdio-published:${next.asset.sha256}`);
  } finally {
    await server.stop(true);
  }
});

test("editing the active source during preparation preserves the new local override", async () => {
  const project = await app.deps.projectService.create({ name: "Concurrent edit" });
  const source = createTestExtensionSource({ root, installName: "edit", name: "unrelated", displayName: "Unrelated" });
  const first = await stage(project.id, source);
  await activatePublication(app.deps, project.id, first.publication, first.asset);
  const previous = await installed(project.id);
  const draft = join(previous.installedSource.source_path, "draft.txt");
  await writeFile(
    join(source, "extension.ts"),
    `await Bun.write(${JSON.stringify(draft)}, "private draft"); export default {};`,
  );
  const next = await stage(project.id, source);
  expect(await activatePublication(app.deps, project.id, next.publication, next.asset)).toBe("local-override");
  expect((await installed(project.id)).installedSource.source_path).toBe(previous.installedSource.source_path);
  expect(await readFile(draft, "utf8")).toBe("private draft");
});

test("a shared disable reaches a private override without executing an incompatible published package", async () => {
  const project = await app.deps.projectService.create({ name: "Private automation" });
  const source = createTestExtensionSource({
    root,
    installName: "private-automation",
    name: "unrelated",
    displayName: "Unrelated",
  });
  const first = await stage(project.id, source);
  await activatePublication(app.deps, project.id, { ...first.publication, automation: true }, first.asset);
  const previous = await installed(project.id);
  await writeFile(join(previous.installedSource.source_path, "draft.txt"), "private override");
  await writeFile(
    join(source, "extension.ts"),
    'throw new Error("must not evaluate remote implementation"); export default {};',
  );
  const next = await stage(project.id, source);
  expect(
    await activatePublication(
      app.deps,
      project.id,
      { ...next.publication, automation: true, enabled: false },
      next.asset,
    ),
  ).toBe("local-override");
  expect((await installed(project.id)).instance.enabled).toBe(false);
  expect((await installed(project.id)).installedSource.source_path).toBe(previous.installedSource.source_path);
});

test("catch-up restores an evicted published cache without replacing the instance or its data", async () => {
  const project = await app.deps.projectService.create({ name: "Evicted cache" });
  const source = createTestExtensionSource({
    root,
    installName: "evicted",
    name: "unrelated",
    displayName: "Unrelated",
  });
  const first = await stage(project.id, source);
  await activatePublication(app.deps, project.id, first.publication, first.asset);
  const previous = await installed(project.id);
  await rm(previous.installedSource.source_path, { recursive: true, force: true });
  await activatePublication(app.deps, project.id, first.publication, first.asset);
  const repaired = await installed(project.id);
  expect(repaired.instance.id).toBe(previous.instance.id);
  expect(await readFile(join(repaired.installedSource.source_path, "extension.ts"), "utf8")).toBe(
    "export default {};\n",
  );
});

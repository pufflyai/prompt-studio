import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { activatePublishedSet } from "./activate";
import { openPublishedCatalog, publishedEntries, publishedOwner } from "./catalog";
import { changePublishedCatalog } from "./change-catalog";
import { packExtension } from "./package";

let app: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "published-change-"));
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
  await rm(root, { recursive: true, force: true });
});

const extensionId = "test.unrelated";
const catalogOf = (projectId: string) => openPublishedCatalog(app.deps, projectId);
const selection = async (projectId: string) => (await catalogOf(projectId)).records.read(extensionId);
const installed = async (projectId: string) =>
  (await app.deps.extensionService.listProjectExtensionInstances(projectId))[0]!;
// Selects a package without running it, like a change that another device shared.
const select = async (projectId: string, source: string) => {
  const asset = await app.deps.assetTransferService.stage(
    publishedOwner(projectId),
    crypto.randomUUID(),
    await packExtension(source),
  );
  const catalog = await catalogOf(projectId);
  await catalog.select({ extensionId, revision: asset.sha256, version: "0.0.0", enabled: true }, asset);
  return asset.sha256;
};
const catchUp = async (projectId: string) =>
  activatePublishedSet(app.deps, projectId, publishedEntries(await (await catalogOf(projectId)).list()));
const publishedProject = async (name: string) => {
  const project = await app.deps.projectService.create({ name });
  const source = createTestExtensionSource({ root, installName: name, name: "unrelated", displayName: "Unrelated" });
  const first = await select(project.id, source);
  await catchUp(project.id);
  return { projectId: project.id, source, first };
};

test("switching a published extension also applies the change on this device", async () => {
  const { projectId, source, first } = await publishedProject("switch");
  await changePublishedCatalog(app.deps, projectId, {
    kind: "enabled",
    extensionId,
    enabled: false,
    expectedRevision: (await selection(projectId)).revision,
  });
  expect((await installed(projectId)).instance.enabled).toBe(false);

  await writeFile(join(source, "new.txt"), "second revision");
  const second = await select(projectId, source);
  await catchUp(projectId);
  expect((await installed(projectId)).installedSource.loaded_revision).toBe(second);
  await changePublishedCatalog(app.deps, projectId, {
    kind: "rollback",
    extensionId,
    revision: first,
    expectedRevision: (await selection(projectId)).revision,
  });
  expect((await installed(projectId)).installedSource.loaded_revision).toBe(first);
});

test("a rollback that cannot run on this device is not shared", async () => {
  const { projectId, source } = await publishedProject("refused");
  await writeFile(join(source, "extension.ts"), 'throw new Error("broken revision"); export default {};');
  const broken = await select(projectId, source);
  await writeFile(join(source, "extension.ts"), "export default {};\n");
  await writeFile(join(source, "new.txt"), "working revision");
  const working = await select(projectId, source);
  await catchUp(projectId);

  await expect(
    changePublishedCatalog(app.deps, projectId, {
      kind: "rollback",
      extensionId,
      revision: broken,
      expectedRevision: (await selection(projectId)).revision,
    }),
  ).rejects.toThrow("broken revision");
  expect((await selection(projectId)).value).toEqual({ revision: working, enabled: true });
  expect((await installed(projectId)).installedSource.loaded_revision).toBe(working);
});

test("a rollback repairs a selection whose package is missing", async () => {
  const { projectId, first } = await publishedProject("repair");
  const catalog = await catalogOf(projectId);
  await catalog.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: extensionId, replace: { revision: "f".repeat(64), enabled: true } }],
  });
  expect((await catalog.read(extensionId)).damaged).toBe(true);

  await changePublishedCatalog(app.deps, projectId, {
    kind: "rollback",
    extensionId,
    revision: first,
    expectedRevision: (await selection(projectId)).revision,
  });
  const repaired = await catalog.read(extensionId);
  expect(repaired.damaged).toBe(false);
  expect(repaired.value).toMatchObject({ revision: first, enabled: true });
});

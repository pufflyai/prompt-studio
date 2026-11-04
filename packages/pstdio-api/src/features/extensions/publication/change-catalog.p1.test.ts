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
import { PublicationChangedError } from "./types";

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

test("a change that loses the shared save returns this device to the shared set", async () => {
  const { projectId, source, first } = await publishedProject("lost");
  await writeFile(join(source, "new.txt"), "second revision");
  const second = await select(projectId, source);
  await catchUp(projectId);
  const { extensionService } = app.deps;
  let competed = false;
  const deps = {
    ...app.deps,
    extensionService: {
      ...extensionService,
      activatePublishedExtensions: async (
        plans: Parameters<typeof extensionService.activatePublishedExtensions>[0],
      ) => {
        const activated = await extensionService.activatePublishedExtensions(plans);
        if (competed) return activated;
        competed = true;
        // Another device's choice lands after this device switched and before it shares its own.
        await (await catalogOf(projectId)).records.commit({
          operationId: crypto.randomUUID(),
          edits: [{ recordId: extensionId, replace: { revision: second, enabled: false } }],
        });
        return activated;
      },
    },
  };

  await expect(
    changePublishedCatalog(deps, projectId, {
      kind: "rollback",
      extensionId,
      revision: first,
      expectedRevision: (await selection(projectId)).revision,
    }),
  ).rejects.toThrow(PublicationChangedError);
  const current = await installed(projectId);
  expect(current.installedSource.loaded_revision).toBe(second);
  expect(current.instance.enabled).toBe(false);
});

// Another device's choice lands after this device switched (`switched`) and, optionally, while it
// returns to the shared set (`returning`), before that second activation runs.
const racingDeps = (switched: () => Promise<unknown>, returning?: () => Promise<unknown>) => {
  const { extensionService, extensionRuntimeCatalog } = app.deps;
  let activations = 0;
  let validations = 0;
  return {
    ...app.deps,
    extensionService: {
      ...extensionService,
      activatePublishedExtensions: async (
        plans: Parameters<typeof extensionService.activatePublishedExtensions>[0],
      ) => {
        const activated = await extensionService.activatePublishedExtensions(plans);
        if (++activations === 1) await switched();
        return activated;
      },
    },
    extensionRuntimeCatalog: {
      ...extensionRuntimeCatalog,
      validateResourcePrefixSet: async (
        sources: Parameters<typeof extensionRuntimeCatalog.validateResourcePrefixSet>[0],
      ) => {
        await extensionRuntimeCatalog.validateResourcePrefixSet(sources);
        if (++validations === 2) await returning?.();
      },
    },
  };
};
const share = async (projectId: string, value: { revision: string; enabled: boolean }) =>
  (await catalogOf(projectId)).records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: extensionId, replace: value }],
  });

test("a change that loses the shared save still reports the conflict when returning to the shared set fails", async () => {
  const { projectId } = await publishedProject("lost-recovery");
  // The competing choice names a package this device does not have, so returning to it fails.
  const deps = racingDeps(() => share(projectId, { revision: "f".repeat(64), enabled: true }));

  await expect(
    changePublishedCatalog(deps, projectId, {
      kind: "enabled",
      extensionId,
      enabled: false,
      expectedRevision: (await selection(projectId)).revision,
    }),
  ).rejects.toThrow(PublicationChangedError);
});

test("returning to the shared set does not undo a newer shared choice", async () => {
  const { projectId, source, first } = await publishedProject("newer");
  await writeFile(join(source, "new.txt"), "second revision");
  const second = await select(projectId, source);
  await catchUp(projectId);
  const deps = racingDeps(
    () => share(projectId, { revision: second, enabled: false }),
    () => share(projectId, { revision: second, enabled: true }),
  );

  await expect(
    changePublishedCatalog(deps, projectId, {
      kind: "rollback",
      extensionId,
      revision: first,
      expectedRevision: (await selection(projectId)).revision,
    }),
  ).rejects.toThrow(PublicationChangedError);
  const current = await installed(projectId);
  expect(current.installedSource.loaded_revision).toBe(second);
  expect(current.instance.enabled).toBe(true);
});

test.each([
  "same set",
  "added member",
])("retrying a failed rollback saves its shared selection and progress: %s", async (mode) => {
  const { projectId, source, first } = await publishedProject(`retry-rollback-${mode}`);
  await writeFile(join(source, "new.txt"), "second revision");
  await select(projectId, source);
  await catchUp(projectId);
  const transfer = app.deps.assetTransferService;
  const read = transfer.read.bind(transfer);
  let unavailable = true;
  const deps = {
    ...app.deps,
    assetTransferService: {
      ...transfer,
      read: async (...args: Parameters<typeof read>) => {
        if (unavailable) throw new Error("Download interrupted");
        return read(...args);
      },
    },
  };
  await expect(
    changePublishedCatalog(deps, projectId, {
      kind: "rollback",
      extensionId,
      revision: first,
      expectedRevision: (await selection(projectId)).revision,
    }),
  ).rejects.toThrow("Download interrupted");
  if (mode === "added member") {
    const added = createTestExtensionSource({ root, installName: "added", name: "added", displayName: "Added" });
    const asset = await app.deps.assetTransferService.stage(
      publishedOwner(projectId),
      crypto.randomUUID(),
      await packExtension(added),
    );
    await (await catalogOf(projectId)).select(
      { extensionId: "test.added", revision: asset.sha256, version: "0.0.0", enabled: true },
      asset,
    );
  }
  unavailable = false;
  const job = app.deps.extensionInstallations
    .list()
    .reverse()
    .find((item) => item.projectId === projectId)!;
  app.deps.extensionInstallations.retry(job.id);
  await app.deps.extensionInstallations.wait(job.id);
  expect((await installed(projectId)).installedSource.loaded_revision).toBe(first);
  expect((await selection(projectId)).value).toMatchObject({ revision: first });
  if (mode === "added member") {
    expect(
      app.deps.extensionInstallations
        .list()
        .filter((item) => item.projectId === projectId)
        .map((item) => item.extensionId),
    ).toContain("test.added");
  }
});

test("retrying adoption reads the latest shared set with its own lifetime", async () => {
  const { adoptPublishedExtension } = await import("./change-catalog");
  const { projectId, source } = await publishedProject("retry-adopt");
  await writeFile(join(source, "new.txt"), "adopted revision");
  await select(projectId, source);
  const transfer = app.deps.assetTransferService;
  const read = transfer.read.bind(transfer);
  let unavailable = true;
  const deps = {
    ...app.deps,
    assetTransferService: {
      ...transfer,
      read: async (...args: Parameters<typeof read>) => {
        if (unavailable) throw new Error("Download interrupted");
        return read(...args);
      },
    },
  };
  const caller = new AbortController();
  await expect(adoptPublishedExtension(deps, projectId, extensionId, caller.signal)).rejects.toThrow(
    "Download interrupted",
  );
  await writeFile(join(source, "latest.txt"), "latest shared revision");
  const latest = await select(projectId, source);
  unavailable = false;
  caller.abort();
  const job = app.deps.extensionInstallations
    .list()
    .reverse()
    .find((item) => item.projectId === projectId)!;
  app.deps.extensionInstallations.retry(job.id);
  await app.deps.extensionInstallations.wait(job.id);
  expect((await installed(projectId)).installedSource.loaded_revision).toBe(latest);
});

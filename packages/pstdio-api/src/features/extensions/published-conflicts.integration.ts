import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConformanceServices } from "pstdio-sync-contracts/conformance";
import { createTestApp } from "../../test-utils/create-test-app";
import { createRecordAssets } from "./command-environment/record-assets";
import { loadExtensionSource } from "./extension-runtime";
import { localExecutionBoundaries, mergePublishedConflict } from "./local-conflicts";
import { openPublishedCatalog, publishExtension, publishedOwner } from "./publication/catalog";
import { createCatalogRelayFixture } from "./synchronized-automations/relay.fixture";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

test("published pure handlers ignore development overrides and retain failed, stale and simultaneous proposals", async () => {
  const services = await createConformanceServices(
    process.env.SYNC_TEST_DATABASE_URL!,
    process.env.SYNC_TEST_OBJECT_ENDPOINT!,
  );
  const root = await mkdtemp(join(tmpdir(), "published-conflicts-"));
  const apps: Awaited<ReturnType<typeof createTestApp>>[] = [];
  try {
    const projectId = crypto.randomUUID();
    for (let index = 0; index < 2; index++) {
      const app = await createTestApp({ storageRoot: join(root, String(index)) });
      apps.push(app);
      await app.deps.projectService.create({ id: projectId, name: "Merge acceptance" });
    }
    const a = apps[0]!;
    const source = createTestExtensionSource({
      root,
      name: "unrelated",
      installName: "unrelated",
      displayName: "Unrelated",
    });
    await writeFile(
      join(source, "extension.ts"),
      `export default {conflictHandlers: {
      merge: (inspection) => {
        if (inspection.accepted.some(r => r.recordId === "decline")) return null;
        if (inspection.accepted.some(r => r.recordId === "throws")) throw new Error("domain failure");
        return inspection.accepted.map(record => ({recordId: record.recordId,
          replace: [record.value, ...inspection.alternatives.flatMap(a => a.records.filter(r => r.recordId === record.recordId).map(r => r.value))].join("+") }));
      }
    }};`,
    );
    const loaded = await loadExtensionSource(source);
    const enabled = await a.deps.extensionService.enableInstalledSourceForProject({
      projectId,
      sourcePath: source,
      extensionId: loaded.metadata.id,
      installName: "unrelated",
      name: "unrelated",
      displayName: "Unrelated",
      manifest: loaded.manifest,
    });
    const catalogs = await Promise.all(apps.map((app) => openPublishedCatalog(app.deps, projectId)));
    const catalogRelay = createCatalogRelayFixture(projectId, services, publishedOwner(projectId).extensionId);
    await publishExtension(a.deps, {
      projectId,
      instanceId: enabled.instance.id,
      expectedRevision: (await catalogs[0]!.records.read(loaded.metadata.id)).revision,
    });
    await catalogs[0]!.synchronize(catalogRelay);
    await catalogs[1]!.synchronize(catalogRelay);
    const publication = await catalogs[0]!.records.read(loaded.metadata.id);
    const owner = { workbenchId: projectId, extensionId: loaded.metadata.id };
    const stores = await Promise.all(
      apps.map((app) =>
        app.deps.extensionStorageService.open({
          owner,
          assets: createRecordAssets(app.deps.assetTransferService, owner),
        }),
      ),
    );
    const [first, second] = stores as [(typeof stores)[number], (typeof stores)[number]];
    const relay = createCatalogRelayFixture(projectId, services, owner.extensionId);
    const keys = ["mergeable", "decline", "throws", "simultaneous", "stale-input", "stale-package"];
    const empty = await Promise.all(keys.map((id) => first.records.read(id)));
    await first.records.commit({
      operationId: "seed",
      edits: empty.map((record) => ({ recordId: record.recordId, expectedRevision: record.revision, replace: "base" })),
    });
    await first.synchronize(relay);
    await services.relay.publish(relay.scope, publication.asset!.sha256);
    await first.synchronize(relay);
    await second.synchronize(relay);
    const before = await Promise.all(keys.map((id) => second.records.read(id)));
    await first.records.commit({
      operationId: "winner",
      edits: keys.map((id, index) => ({
        recordId: id,
        expectedRevision: before[index]!.revision,
        replace: "accepted",
      })),
    });
    await first.synchronize(relay);
    for (let index = 0; index < keys.length; index++) {
      await second.records.commit({
        operationId: `branch-${keys[index]}`,
        edits: [{ recordId: keys[index]!, expectedRevision: before[index]!.revision, replace: "alternative" }],
      });
    }
    await second.synchronize(relay);
    await first.synchronize(relay);
    // The unpublished override must never select or replace the automatic merge code.
    await writeFile(
      join(source, "extension.ts"),
      "export default {conflictHandlers: {merge: () => {throw new Error('override ran')}}};",
    );
    const merge = (conflictId: string) =>
      mergePublishedConflict(a.deps, { projectId, extensionId: owner.extensionId, conflictId });
    await localExecutionBoundaries(a.deps).beforeDispatch!({
      projectId,
      extensionId: owner.extensionId,
      recordIds: ["mergeable"],
    });
    expect((await first.records.read("mergeable")).value).toBe("accepted+alternative");
    const mutation = (await first.readState()).journal.find(
      (entry) => entry.mutation.resolution?.conflictId === "branch-mergeable",
    )!.mutation;
    expect(mutation.resolution!.handler).toEqual({ publishedRevision: publication.asset!.sha256, handlerId: "merge" });
    for (const id of ["decline", "throws"]) {
      await expect(
        localExecutionBoundaries(a.deps).beforeDispatch!({
          projectId,
          extensionId: owner.extensionId,
          recordIds: [id],
        }),
      ).rejects.toThrow("Unresolved storage conflict");
      expect((await first.records.inspect(`branch-${id}`)).alternatives[0]!.records[0]!.value).toBe("alternative");
    }
    await Promise.all([merge("branch-simultaneous"), merge("branch-simultaneous")]);
    expect((await first.records.read("simultaneous")).value).toBe("accepted+alternative");
    const staleInput = await first.records.inspect("branch-stale-input");
    const inputRecord = await first.records.read("stale-input");
    await first.records.commit({
      operationId: "progress",
      edits: [{ recordId: "stale-input", expectedRevision: inputRecord.revision, replace: "progress" }],
    });
    expect(
      (
        await first.records.resolve({
          ...staleInput,
          operationId: "stale-input-proposal",
          choose: "remote",
          handler: mutation.resolution!.handler,
          edits: [{ recordId: "stale-input", replace: "wrong" }],
        })
      ).status,
    ).toBe("conflict");
    expect((await first.records.read("stale-input")).value).toBe("progress");
    const stalePackage = await first.records.inspect("branch-stale-package");
    await services.relay.publish(relay.scope, "new-package");
    await first.synchronize(relay);
    expect(
      (
        await first.records.resolve({
          ...stalePackage,
          operationId: "stale-package-proposal",
          choose: "remote",
          handler: mutation.resolution!.handler,
          edits: [{ recordId: "stale-package", replace: "wrong" }],
        })
      ).status,
    ).toBe("conflict");
    expect((await first.records.read("stale-package")).value).toBe("accepted");
    await writeFile(join(source, "extension.ts"), "export default {};");
    await publishExtension(a.deps, {
      projectId,
      instanceId: enabled.instance.id,
      expectedRevision: (await catalogs[0]!.records.read(loaded.metadata.id)).revision,
    });
    await catalogs[0]!.synchronize(catalogRelay);
    const withoutHandler = await catalogs[0]!.records.read(loaded.metadata.id);
    await services.relay.publish(relay.scope, withoutHandler.asset!.sha256);
    await first.synchronize(relay);
    expect(await merge("branch-decline")).toBeUndefined();
    expect((await first.records.inspect("branch-decline")).alternatives.length).toBeGreaterThan(0);
  } finally {
    await Promise.all(apps.map((app) => app.close()));
    await services.close();
    await rm(root, { recursive: true, force: true });
  }
});

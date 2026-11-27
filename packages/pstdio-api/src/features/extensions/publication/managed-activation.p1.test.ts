import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TeamExtensionPolicy } from "pstdio-sync-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { createStorageApi } from "../command-environment/storage";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { activatePublishedSet } from "./activate";
import { openPublishedCatalog, publishedEntries, publishedOwner } from "./catalog";
import { packExtension } from "./package";

test("team-required frozen tools override shared changes and remain installed after the requirement ends", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-activation-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Team recipient" });
    const source = createTestExtensionSource({ root, installName: "trusted", name: "unrelated", displayName: "Tools" });
    await writeFile(join(source, "payload.txt"), "trusted team revision");
    const bytes = await packExtension(source);
    const revision = new Bun.CryptoHasher("sha256").update(await bytes.arrayBuffer()).digest("hex");
    const extensionId = "test.unrelated";
    let policy: TeamExtensionPolicy[] = [
      {
        extensionId,
        selectionId: "required",
        required: {
          extensionId,
          selectionId: "required",
          name: "Tools",
          version: "0.0.0",
          revision,
        },
      },
    ];
    // Manager authorization and authenticated download are covered by their service integrations.
    // This boundary supplies their verified result to the real host activation and asset services.
    app.deps.accountService.readManagedProjectPolicy = async () => policy;
    app.deps.accountService.readCachedManagedProjectPolicy = async () => policy;
    let downloads = 0;
    app.deps.accountService.downloadManagedPackage = async () => {
      downloads++;
      return bytes;
    };

    await writeFile(join(source, "payload.txt"), "ordinary shared replacement");
    const other = await app.deps.assetTransferService.stage(
      publishedOwner(project.id),
      "ordinary",
      await packExtension(source),
    );
    const catalog = await openPublishedCatalog(app.deps, project.id);
    await catalog.records.commit({
      operationId: "untrusted-shared-selection",
      edits: [
        { recordId: `package:${other.sha256}`, replace: { extensionId, version: "0.0.0" }, asset: other },
        { recordId: extensionId, replace: { revision: other.sha256, enabled: false } },
      ],
    });
    const synchronize = async () => activatePublishedSet(app.deps, project.id, publishedEntries(await catalog.list()));
    const current = async () =>
      (await app.deps.extensionService.listProjectExtensionInstances(project.id)).find(
        (row) => row.installedSource.extension_id === extensionId,
      )!;
    await synchronize();
    expect((await current()).instance.enabled).toBe(true);
    const storage = createStorageApi(app.deps, {
      projectId: project.id,
      extensionId,
      extensionInstanceId: (await current()).instance.id,
    });
    await storage.set("managed-write", "allowed");
    await storage.migrate(1, async () => {
      await storage.set("managed-migration", "ran");
    });
    expect(await storage.get("managed-write")).toBe("allowed");
    expect(await storage.get("managed-migration")).toBe("ran");
    const superseded = createStorageApi(app.deps, {
      projectId: project.id,
      extensionId,
      extensionInstanceId: (await current()).instance.id,
      source: { version: "0.0.0", source_ref: `pstdio-published:${other.sha256}`, source_path: source },
    });
    await expectRejection(superseded.set("managed-write", "superseded code")).toThrow("Update");
    expect(await superseded.canMigrate()).toBe(false);
    // Data writes need the native decision and invoking revision, even if package bytes were evicted.
    await app.deps.assetTransferService.removeProjectBytes(project.id);
    await storage.set("managed-write", "native decision remains usable");
    await expectRejection(superseded.set("managed-write", "superseded code")).toThrow("Update");
    expect(await storage.canMigrate()).toBe(false);
    await app.deps.assetTransferService.stage(publishedOwner(project.id), `team-managed:${revision}`, bytes);
    await app.deps.assetTransferService.stage(publishedOwner(project.id), "ordinary", await packExtension(source));
    expect((await current()).installedSource.loaded_revision).toBe(revision);
    expect(await readFile(join((await current()).installedSource.source_path, "payload.txt"), "utf8")).toBe(
      "trusted team revision",
    );
    const installedId = (await current()).instance.id;
    await synchronize();
    expect((await current()).instance.id).toBe(installedId);
    expect(downloads).toBe(1);

    await catalog.records.commit({
      operationId: "untrusted-malformed-selection",
      edits: [{ recordId: extensionId, replace: { malformed: true }, deleted: false }],
    });
    await synchronize();
    expect((await current()).instance.enabled).toBe(true);

    await storage.set("managed-write", "malformed selector ignored");
    await storage.migrate(2, async () => {
      await storage.set("managed-migration", "malformed selector ignored");
    });
    expect(await storage.get("managed-migration")).toBe("malformed selector ignored");

    await catalog.records.commit({
      operationId: "untrusted-shared-removal",
      edits: [{ recordId: extensionId, deleted: true }],
    });
    await synchronize();
    expect((await current()).instance.enabled).toBe(true);
    await writeFile(join((await current()).installedSource.source_path, "payload.txt"), "local substitution");
    await synchronize();
    expect(await readFile(join((await current()).installedSource.source_path, "payload.txt"), "utf8")).toBe(
      "trusted team revision",
    );

    await catalog.records.commit({
      operationId: "untrusted-managed-baseline",
      edits: [{ recordId: `package:${revision}`, replace: { extensionId, version: "0.0.0" }, asset: other }],
    });
    policy = [{ extensionId, selectionId: "released", required: null }];
    const releasedId = (await current()).instance.id;
    await synchronize();
    expect((await current()).instance.id).toBe(releasedId);
    expect((await current()).instance.enabled).toBe(true);

    await catalog.change(extensionId, undefined, ({ records }) =>
      records.commit({
        operationId: "explicit-released-removal",
        edits: [{ recordId: extensionId, deleted: true }],
      }),
    );
    await synchronize();
    expect((await current()).instance.enabled).toBe(false);

    // A new explicit ordinary choice is accepted under the released policy decision.
    await catalog.select({ extensionId, revision: other.sha256, version: "0.0.0", enabled: true }, other);
    await synchronize();
    expect((await current()).instance.enabled).toBe(true);
    expect((await current()).installedSource.loaded_revision).toBe(other.sha256);

    const previousPath = (await current()).installedSource.source_path;
    policy = [
      {
        extensionId,
        selectionId: "invalid-update",
        required: {
          extensionId,
          selectionId: "invalid-update",
          name: "Tools",
          version: "0.0.0",
          revision: "c".repeat(64),
        },
      },
    ];
    await expectRejection(synchronize()).toThrow();
    expect((await current()).installedSource.source_path).toBe(previousPath);
    expect(await readFile(join(previousPath, "payload.txt"), "utf8")).toBe("ordinary shared replacement");
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

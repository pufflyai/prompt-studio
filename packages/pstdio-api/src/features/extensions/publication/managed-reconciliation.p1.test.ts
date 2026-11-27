import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TeamExtensionPolicy } from "pstdio-sync-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { activatePublishedSet } from "./activate";
import { openPublishedCatalog, publishedEntries } from "./catalog";
import { createManagedExtensionReconciliation } from "./managed-reconciliation";
import { packExtension } from "./package";

test("policy refresh installs required tools in existing and newly admitted copies without shared document changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-reconciliation-"));
  const app = await createTestApp();
  let reconciler: ReturnType<typeof createManagedExtensionReconciliation> | undefined;
  try {
    const first = await app.deps.projectService.create({ name: "Existing team project" });
    const source = createTestExtensionSource({ root, installName: "managed", name: "managed", displayName: "Managed" });
    const bytes = new Map<string, Blob>();
    let policy: TeamExtensionPolicy[] = [];
    const select = async (value: string) => {
      await writeFile(join(source, "payload.txt"), value);
      const packed = await packExtension(source);
      const revision = new Bun.CryptoHasher("sha256").update(await packed.arrayBuffer()).digest("hex");
      bytes.set(revision, packed);
      policy = [
        {
          extensionId: "test.managed",
          selectionId: value,
          required: { extensionId: "test.managed", selectionId: value, revision, version: "0.0.0", name: "Managed" },
        },
      ];
      return revision;
    };
    const revision = await select("first required revision");
    app.deps.accountService.readManagedProjectPolicy = async () => policy;
    let downloads = 0;
    app.deps.accountService.downloadManagedPackage = async (_projectId, required) => {
      downloads++;
      return bytes.get(required.revision)!;
    };
    const projects = [{ projectId: first.id, scope: "member/device/team/grant-a" }];
    const failures: unknown[] = [];
    let unavailable: string | undefined;
    reconciler = createManagedExtensionReconciliation({
      projects: async () => projects,
      policy: async (id) => {
        if (id === unavailable) throw new TypeError("Project policy temporarily unavailable");
        return policy;
      },
      apply: async (projectId, signal) => {
        const catalog = await openPublishedCatalog(app.deps, projectId, signal);
        return activatePublishedSet(app.deps, projectId, publishedEntries(await catalog.list()), signal);
      },
      failed: (_id, error) => failures.push(error),
    });
    const installed = async (projectId: string) =>
      (await app.deps.extensionService.listProjectExtensionInstances(projectId)).find(
        (row) => row.installedSource.extension_id === "test.managed",
      );
    await reconciler.changed();
    expect((await installed(first.id))?.installedSource.loaded_revision).toBe(revision);
    expect((await installed(first.id))?.instance.enabled).toBe(true);
    const originalSource = (await installed(first.id))!.installedSource.id;
    await reconciler.changed();
    expect((await installed(first.id))?.installedSource.id).toBe(originalSource);
    expect(downloads).toBe(1);

    const second = await app.deps.projectService.create({ name: "Newly admitted team project" });
    projects.push({ projectId: second.id, scope: "member/device/team/grant-b" });
    await reconciler.changed();
    expect((await installed(second.id))?.installedSource.loaded_revision).toBe(revision);
    const next = await select("updated team revision");
    await reconciler.changed();
    for (const { projectId } of projects)
      expect((await installed(projectId))?.installedSource.loaded_revision).toBe(next);

    const ids = await Promise.all(projects.map(async ({ projectId }) => (await installed(projectId))!.instance.id));
    policy = [{ extensionId: "test.managed", selectionId: "released", required: null }];
    await reconciler.changed();
    for (const [index, { projectId }] of projects.entries()) {
      expect((await installed(projectId))?.instance.id).toBe(ids[index]);
      expect((await installed(projectId))?.instance.enabled).toBe(true);
    }
    expect(failures).toEqual([]);

    const recovered = await select("retry after interrupted policy fetch");
    unavailable = first.id;
    await reconciler.changed();
    expect((await installed(first.id))?.installedSource.loaded_revision).toBe(next);
    expect((await installed(second.id))?.installedSource.loaded_revision).toBe(recovered);
    expect(failures).toHaveLength(1);
    unavailable = undefined;
    await reconciler.changed();
    expect((await installed(first.id))?.installedSource.loaded_revision).toBe(recovered);

    await select("interrupted during shutdown");
    const downloading = Promise.withResolvers<void>();
    app.deps.accountService.downloadManagedPackage = async (_id, _required, signal) => {
      downloading.resolve();
      if (!signal) throw new Error("Automatic package work needs a shutdown signal");
      return new Promise<Blob>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    };
    const updating = reconciler.changed();
    await downloading.promise;
    await reconciler.close();
    await updating;
    await reconciler.changed();
    for (const { projectId } of projects)
      expect((await installed(projectId))?.installedSource.loaded_revision).toBe(recovered);
  } finally {
    await reconciler?.close();
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

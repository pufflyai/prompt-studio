import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openPublishedCatalog, publishedOwner } from "../../features/extensions/publication/catalog";
import { packExtension } from "../../features/extensions/publication/package";
import { createTestExtensionSource } from "../../features/extensions/test-utils/create-test-extension-source";
import { recoveryJournalKey } from "../project-recovery/journal";
import { recoverySourceId } from "../project-recovery/local-source";
import { projectRecoveryRoot } from "../project-recovery/project-paths";
import { createDownloadSourcesFixture, until } from "./project-download-sources.fixture";

const finish = (source: Awaited<ReturnType<typeof createDownloadSourcesFixture>>["traffic"]["core"]) => {
  source.hold = false;
  source.finish.resolve();
};

test("Download retries a known folder relay failure even when the local journal cannot be read", async () => {
  let entered = false;
  const release = Promise.withResolvers<void>();
  const fixture = await createDownloadSourcesFixture({
    failedFolder: true,
    afterStatus: async () => {
      entered = true;
      await release.promise;
    },
  });
  try {
    await fixture.host.deps.accountService.refresh();
    expect(await until(async () => Boolean((await fixture.folder.status()).error))).toBe(true);
    const path = join(fixture.root, "journal-folder");
    await mkdir(path);
    const workspace = await fixture.host.deps.workspaceService.ensureDefault({
      project_id: fixture.id,
      root_path: path,
      name: "Journal source",
    });
    await fixture.host.deps.workspaceService.updateProviderProjection(workspace.id, {
      execution_kind: "local",
      provider_state: "ready",
    });
    const directory = join(projectRecoveryRoot(fixture.host.deps.projectRecovery.root, fixture.id), "sources");
    await mkdir(directory, { recursive: true });
    const key = recoveryJournalKey([
      fixture.id,
      fixture.config.accountId,
      fixture.config.environmentId,
      recoverySourceId(workspace.id, path),
    ]);
    await writeFile(join(directory, `${key}.json`), "Unreadable journal JSON");
    expect(await fixture.folder.folder()).toMatchObject({
      capture: { state: "needs-attention", error: { code: "failed" } },
    });
    const reads = fixture.traffic.folder.reads;
    expect((await fixture.download()).status).toBe(202);
    expect(await until(() => entered)).toBe(true);
    fixture.traffic.folder.error = undefined;
    fixture.traffic.activity.error = undefined;
    release.resolve();
    expect(await until(() => fixture.selections === 1)).toBe(true);
    // Selection happens before the relay's automatic backoff; the unreadable journal is not treated as healthy.
    expect(fixture.folderRetries).toBe(1);
    expect(await until(() => fixture.traffic.folder.holding)).toBe(true);
    expect(fixture.traffic.folder.reads).toBe(reads + 1);
    expect(fixture.traffic.core.cancelled).toBe(0);
    expect(await fixture.canDownload()).toBe(false);
    expect(await fixture.folder.folder()).toMatchObject({
      capture: { state: "needs-attention", error: { code: "failed" } },
    });
  } finally {
    release.resolve();
    await fixture.close();
  }
});

test("Download retains an Activity restart queued offline after its failure was selected", async () => {
  let entered = false;
  let offline = false;
  const release = Promise.withResolvers<void>();
  const reconnect = Promise.withResolvers<void>();
  const fixture = await createDownloadSourcesFixture({
    afterStatus: async () => {
      entered = true;
      await release.promise;
    },
    beforeLiveAccess: async () => {
      if (offline) await reconnect.promise;
    },
  });
  try {
    await fixture.host.deps.accountService.refresh();
    expect(await until(async () => Boolean((await fixture.activity.status()).error))).toBe(true);
    finish(fixture.traffic.core);
    finish(fixture.traffic.folder);
    expect(
      await until(async () => (await fixture.core.status()).downloaded && !(await fixture.core.status()).busy),
    ).toBe(true);
    expect(
      await until(async () => (await fixture.folder.status()).downloaded && !(await fixture.folder.status()).busy),
    ).toBe(true);
    expect((await fixture.download()).status).toBe(202);
    expect(await until(() => entered)).toBe(true);
    offline = true;
    fixture.live.reconnect();
    expect(await until(() => !fixture.live.status().connected)).toBe(true);
    fixture.traffic.activity.error = undefined;
    await fixture.activity.restart();
    expect(await fixture.activity.status()).toMatchObject({ connected: false, busy: true, error: undefined });
    release.resolve();
    expect(await until(() => fixture.selections === 1)).toBe(true);
    expect(await fixture.canDownload()).toBe(false);
    expect((await fixture.download()).status).toBe(202);
    expect(fixture.selections).toBe(1);
    reconnect.resolve();
    expect(await until(() => fixture.traffic.activity.holding)).toBe(true);
    expect(await fixture.canDownload()).toBe(false);
    finish(fixture.traffic.activity);
    expect(
      await until(async () => (await fixture.activity.status()).downloaded && !(await fixture.activity.status()).busy),
    ).toBe(true);
    expect(await until(fixture.canDownload)).toBe(true);
    expect(await fixture.activity.status()).toMatchObject({ downloaded: true, error: undefined });
  } finally {
    release.resolve();
    reconnect.resolve();
    await fixture.close();
  }
});

test.each([
  "document progress",
  "active activation",
  "completed activation",
] as const)("Download preserves logical activation failure identity across %s during authority confirmation", async (overlap) => {
  let entered = false;
  let attempts = 0;
  const release = Promise.withResolvers<void>();
  const activate = Promise.withResolvers<void>();
  const health = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      if (++attempts === 1) return new Response(null, { status: 503 });
      await activate.promise;
      return new Response("ready");
    },
  });
  await using _healthCleanup = { [Symbol.asyncDispose]: () => health.stop(true) };
  const fixture = await createDownloadSourcesFixture({
    publications: true,
    afterStatus: async () => {
      entered = true;
      await release.promise;
    },
  });
  try {
    await fixture.host.deps.accountService.refresh();
    fixture.traffic.activity.error = undefined;
    finish(fixture.traffic.activity);
    finish(fixture.traffic.core);
    finish(fixture.traffic.folder);
    expect(
      await until(
        async () =>
          Boolean((await fixture.publication!.status()).downloaded) && !(await fixture.publication!.status()).busy,
      ),
    ).toBe(true);
    const source = createTestExtensionSource({
      root: fixture.root,
      installName: "retry-overlap",
      name: "retry-overlap",
      displayName: "Retry overlap",
    });
    await writeFile(
      join(source, "extension.ts"),
      `if (!(await fetch(${JSON.stringify(health.url.href)})).ok) throw new Error("Activation unavailable"); export default {};`,
    );
    const asset = await fixture.host.deps.assetTransferService.stage(
      publishedOwner(fixture.id),
      crypto.randomUUID(),
      await packExtension(source),
    );
    const catalog = await openPublishedCatalog(fixture.host.deps, fixture.id);
    await catalog.select(
      { extensionId: "test.retry-overlap", revision: asset.sha256, version: "0.0.0", enabled: true },
      asset,
      (await catalog.read("test.retry-overlap")).revision,
    );
    fixture.publication!.wake();
    expect(
      await until(
        async () =>
          Boolean((await fixture.publication!.status()).needsAttention) && !(await fixture.publication!.status()).busy,
      ),
    ).toBe(true);
    expect(attempts).toBe(1);
    expect((await fixture.download()).status).toBe(202);
    expect(await until(() => entered)).toBe(true);
    let connected = false;
    const stop = fixture.live.listen((event) => {
      if (event.type === "ready") connected = true;
    });
    if (overlap === "document progress") {
      fixture.live.reconnect();
      expect(await until(() => connected)).toBe(true);
      expect(await until(async () => !(await fixture.publication!.status()).busy)).toBe(true);
      expect(await fixture.publication!.status()).toMatchObject({
        downloaded: true,
        needsAttention: true,
        error: undefined,
      });
      expect(attempts).toBe(1);
    } else {
      void fixture.publication!.retry();
      expect(await until(() => attempts === 2)).toBe(true);
      if (overlap === "completed activation") {
        activate.resolve();
        expect(
          await until(
            async () =>
              !(await fixture.publication!.status()).needsAttention && !(await fixture.publication!.status()).busy,
          ),
        ).toBe(true);
      }
    }
    stop();
    release.resolve();
    expect(await until(() => fixture.selections === 1)).toBe(true);
    expect(await until(() => attempts === (overlap === "completed activation" ? 3 : 2))).toBe(true);
    if (overlap !== "completed activation") {
      expect(await fixture.canDownload()).toBe(false);
      expect((await fixture.download()).status).toBe(202);
      expect(fixture.selections).toBe(1);
    }
    activate.resolve();
    expect(
      await until(
        async () =>
          !(await fixture.publication!.status()).needsAttention && !(await fixture.publication!.status()).busy,
      ),
    ).toBe(true);
    expect(await until(fixture.canDownload)).toBe(true);
    expect(await fixture.host.deps.extensionService.listProjectExtensionInstances(fixture.id)).toHaveLength(1);
    // Successful preparation is followed by the installed runtime load; no second preparation is admitted.
    expect(attempts).toBe(3);
  } finally {
    release.resolve();
    activate.resolve();
    await fixture.close();
  }
});

test("whole-project HTTP Retry replaces a stalled restarted native Activity pass", async () => {
  const fixture = await createDownloadSourcesFixture();
  try {
    await fixture.host.deps.accountService.refresh();
    expect(await until(async () => Boolean((await fixture.activity.status()).error))).toBe(true);
    fixture.traffic.activity.error = undefined;
    const retry = () => fetch(`${fixture.api.url.origin}/v1/account/projects/${fixture.id}/retry`, { method: "POST" });
    expect((await retry()).status).toBe(200);
    expect(await until(() => fixture.traffic.activity.holding)).toBe(true);
    const reads = fixture.traffic.activity.reads;
    const cancelled = fixture.traffic.activity.cancelled;
    expect((await retry()).status).toBe(200);
    expect(await until(() => fixture.traffic.activity.reads > reads)).toBe(true);
    expect(fixture.traffic.activity.cancelled).toBeGreaterThan(cancelled);
    finish(fixture.traffic.activity);
    finish(fixture.traffic.core);
    finish(fixture.traffic.folder);
    expect(
      await until(async () => (await fixture.activity.status()).downloaded && !(await fixture.activity.status()).busy),
    ).toBe(true);
    expect(await fixture.activity.status()).toMatchObject({ error: undefined, downloaded: true });
  } finally {
    await fixture.close();
  }
});

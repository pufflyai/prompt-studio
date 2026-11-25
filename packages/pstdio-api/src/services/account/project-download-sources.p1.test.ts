import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extensionTransportName } from "pstdio-api-contracts/extension-host";
import { createSyncSpace } from "pstdio-sync/encryption";
import { coreOwnerId, projectInfoDocumentId } from "pstdio-sync/records";
import { createLiveConnection } from "pstdio-sync/relay";
import { resourceActivityOwnerId } from "../../features/activity/resource-activity-store";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestApp } from "../../test-utils/create-test-app";
import { startCoreDocumentSync } from "../relay/core-documents";
import { startCoreRecordSync } from "../relay/core-records";
import { startFolderRecovery } from "../relay/folder-recovery";
import { projectOwnerProgress, readOwnerStatus } from "../relay/project-owner-progress";
import { createProjectSyncRetry } from "../relay/project-sync-retry";
import { nativeAccountFile } from "./native-account";
import { createNativeStore } from "./native-store";
import { createProjectCopyStore } from "./project-copy-store";

const until = async (ready: () => boolean | Promise<boolean>) => {
  const deadline = Date.now() + 2000;
  while (!(await ready()) && Date.now() < deadline) await Bun.sleep(5);
  return ready();
};

const holdResponse = async (response: Response, release: Promise<void>, started: () => void, cancelled: () => void) => {
  const bytes = new Uint8Array(await response.arrayBuffer());
  return new Response(
    new ReadableStream({
      start(stream) {
        stream.enqueue(bytes.slice(0, 1));
        started();
        void release.then(() => {
          try {
            stream.enqueue(bytes.slice(1));
            stream.close();
          } catch {}
        });
      },
      cancel: cancelled,
    }),
  );
};

const sourceTraffic = (id: string, error?: string) => ({
  id,
  error,
  reads: 0,
  cancelled: 0,
  holding: false,
  hold: true,
  finish: Promise.withResolvers<void>(),
});

const createSourceRelay = (origin: string, sources: ReturnType<typeof sourceTraffic>[]) =>
  Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const source = sources.find((source) => path.endsWith(`/~${source.id}/read`));
      if (source) {
        source.reads++;
        if (source.error) return Response.json({ error: source.error }, { status: 403 });
      }
      const response = await fetch(new Request(new URL(path, origin), request));
      if (!source?.hold) return response;
      return holdResponse(
        response,
        source.finish.promise,
        () => {
          source.holding = true;
        },
        () => {
          source.cancelled++;
        },
      );
    },
  });

for (const [stored, failedFolder] of [
  [true, false],
  [true, true],
  [false, false],
  [false, true],
])
  test(`Download repairs failed owners while healthy first passes finish (stored: ${stored}, failed folder: ${failedFolder})`, async () => {
    const root = await mkdtemp(join(tmpdir(), "native-copy-sources-"));
    const databasePath = join(root, "db");
    const storageRoot = join(root, "storage");
    const host = await createTestApp({ databasePath, storageRoot });
    const id = crypto.randomUUID();
    const peer = documentPeer([id]);
    const controller = new AbortController();
    const space = await createSyncSpace({
      projectId: id,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const coreId = await space.documentId(JSON.stringify([coreOwnerId, projectInfoDocumentId]));
    const activityId = await space.documentId(extensionTransportName(resourceActivityOwnerId, "owner"));
    const personal = await createSyncSpace({
      projectId: id,
      spaceOwner: "alice",
      keys: [{ generation: 1, secret: "B".repeat(43) }],
    });
    const folderId = await personal.documentId(JSON.stringify(["pstdio.folder-recovery", "catalog-v1"]));
    const traffic = {
      core: sourceTraffic(coreId),
      activity: sourceTraffic(activityId, "Activity unavailable"),
      folder: sourceTraffic(folderId, failedFolder ? "Folder catalog unavailable" : undefined),
    };
    let folderRetries = 0;
    const relay = createSourceRelay(peer.origin, Object.values(traffic));
    const access = async () => ({ token: "device", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const live = createLiveConnection({ origin: peer.origin, projectId: id, access, signal: controller.signal });
    const { environmentId } = await host.deps.environmentService.get();
    const config = {
      accountId: "alice",
      workbenchId: id,
      environmentId,
      managerOrigin: peer.origin,
      relayOrigin: relay.url.origin,
      renewalGrant: "grant",
    };
    const core = startCoreDocumentSync({ config, deps: host.deps, access, live, signal: controller.signal });
    const activity = startCoreRecordSync({
      config,
      deps: host.deps,
      ownerId: resourceActivityOwnerId,
      access,
      live,
      signal: controller.signal,
      statusChanged() {},
    });
    const folder = startFolderRecovery({ config, deps: host.deps, access, live, signal: controller.signal });
    const retry = createProjectSyncRetry({
      refresh: async () => {},
      owners: { core: { get: () => core }, activity: { get: () => activity } },
      folders: {
        get: () => ({
          ...folder,
          retry() {
            folderRetries++;
            return folder.retry();
          },
        }),
      },
      extensions: new Map(),
    });
    host.deps.accountService.start(
      async () => {},
      async () =>
        projectOwnerProgress(
          id,
          await Promise.all([core, undefined, undefined, activity].map(readOwnerStatus)),
          [],
          [],
          await folder.folder(),
        ),
      async () => {},
      retry,
    );
    const api = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => host.app.fetch(request) });
    try {
      await host.deps.projectService.create({ id, name: "Mixed source download" });
      const file = nativeAccountFile(databasePath, storageRoot);
      const account = { accountId: config.accountId, managerOrigin: config.managerOrigin, deviceId: environmentId };
      await createNativeStore(file).save({ ...account, relayOrigin: config.relayOrigin, token: config.renewalGrant });
      if (stored)
        await createProjectCopyStore(file).write({
          ...account,
          projectId: id,
          name: "Mixed source download",
          phase: "downloading",
          automatic: true,
        });
      await host.deps.accountService.refresh();
      expect(await until(() => traffic.core.holding)).toBe(true);
      expect(await until(async () => Boolean((await activity.status()).error))).toBe(true);
      if (failedFolder) expect(await until(async () => Boolean((await folder.status()).error))).toBe(true);
      else expect(await until(() => traffic.folder.holding)).toBe(true);
      expect(await core.status()).toMatchObject({
        firstDownloaded: false,
        downloaded: false,
        busy: true,
        error: undefined,
      });
      expect(await activity.status()).toMatchObject({ error: "Cloud source failed; retry scheduled" });
      const expected = new URLSearchParams({ accountId: account.accountId, managerOrigin: account.managerOrigin });
      const download = () =>
        fetch(`${api.url.origin}/v1/account/projects/${id}/download?${expected}`, { method: "POST" });
      const canDownload = async () =>
        (await (await fetch(`${api.url.origin}/v1/account/projects`)).json()).projects.find(
          (p: { id: string }) => p.id === id,
        ).actions.download;
      const failedReads = traffic.activity.reads;
      const previousFolderReads = traffic.folder.reads;
      traffic.activity.error = undefined;
      traffic.folder.error = undefined;
      expect((await download()).status).toBe(202);
      expect(await until(() => traffic.activity.holding)).toBe(true);
      expect(folderRetries).toBe(Number(failedFolder));
      if (failedFolder) expect(await until(() => traffic.folder.holding)).toBe(true);
      expect(traffic.folder.cancelled).toBe(0);
      expect(traffic.folder.reads).toBe(previousFolderReads + Number(failedFolder));
      expect(traffic.core.cancelled).toBe(0);
      expect(traffic.core.reads).toBe(1);
      expect(traffic.activity.reads).toBe(failedReads + 1);
      expect(await canDownload()).toBe(false);
      expect((await download()).status).toBe(202);
      expect(folderRetries).toBe(Number(failedFolder));
      expect({ core: traffic.core.reads, activity: traffic.activity.reads }).toEqual({
        core: 1,
        activity: failedReads + 1,
      });
      traffic.core.hold = false;
      traffic.core.finish.resolve();
      expect(await until(async () => (await core.status()).firstDownloaded)).toBe(true);
      expect(await core.status()).toMatchObject({ downloaded: true, error: undefined });
      expect(traffic.core.cancelled).toBe(0);
      expect(await canDownload()).toBe(false);
      traffic.activity.hold = false;
      traffic.activity.finish.resolve();
      expect(await until(async () => (await activity.status()).downloaded)).toBe(true);
      if (failedFolder) expect(await canDownload()).toBe(false);
      traffic.folder.hold = false;
      traffic.folder.finish.resolve();
      expect(await until(async () => (await folder.status()).downloaded)).toBe(true);
      expect(traffic.folder.cancelled).toBe(0);
      expect(await until(canDownload)).toBe(true);
    } finally {
      traffic.core.finish.resolve();
      traffic.activity.finish.resolve();
      traffic.folder.finish.resolve();
      core.close();
      activity.close();
      folder.close();
      controller.abort();
      await Promise.all([core.done, activity.done, folder.done, live.done]);
      await api.stop(true);
      await relay.stop(true);
      await peer.close();
      await host.close();
      await rm(root, { recursive: true, force: true });
    }
  });

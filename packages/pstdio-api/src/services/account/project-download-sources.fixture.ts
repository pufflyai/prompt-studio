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
import { startPublishedExtensions } from "../relay/publications";
import { nativeAccountFile } from "./native-account";
import { createNativeStore } from "./native-store";
import { createProjectCopyStore } from "./project-copy-store";

export const until = async (ready: () => boolean | Promise<boolean>) => {
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

export const createDownloadSourcesFixture = async ({
  stored = true,
  failedFolder = false,
  afterStatus,
  beforeLiveAccess,
  publications = false,
}: {
  stored?: boolean;
  failedFolder?: boolean;
  afterStatus?: () => Promise<void>;
  beforeLiveAccess?: () => Promise<void>;
  publications?: boolean;
} = {}) => {
  const root = await mkdtemp(join(tmpdir(), "native-copy-sources-"));
  const resources: (() => unknown | Promise<unknown>)[] = [() => rm(root, { recursive: true, force: true })];
  const dispose = async () => {
    const errors: unknown[] = [];
    while (resources.length) {
      try {
        await resources.pop()!();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, "Download fixture cleanup failed");
  };
  try {
    const databasePath = ":memory:";
    const storageRoot = join(root, "storage");
    const host = await createTestApp({ databasePath, storageRoot });
    resources.push(() => host.close());
    const id = crypto.randomUUID();
    const peer = documentPeer([id]);
    resources.push(() => peer.close());
    const controller = new AbortController();
    resources.push(() => controller.abort());
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
    resources.push(() => relay.stop(true));
    const access = async () => ({ token: "device", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const live = createLiveConnection({
      origin: peer.origin,
      projectId: id,
      access: async () => {
        await beforeLiveAccess?.();
        return access();
      },
      signal: controller.signal,
    });
    resources.push(async () => {
      live.close();
      await live.done;
    });
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
    resources.push(async () => {
      core.close();
      await core.done;
    });
    const activity = startCoreRecordSync({
      config,
      deps: host.deps,
      ownerId: resourceActivityOwnerId,
      access,
      live,
      signal: controller.signal,
      statusChanged() {},
    });
    resources.push(async () => {
      activity.close();
      await activity.done;
    });
    const folder = startFolderRecovery({ config, deps: host.deps, access, live, signal: controller.signal });
    resources.push(async () => {
      folder.close();
      await folder.done;
    });
    const publication = publications
      ? startPublishedExtensions({ config, deps: host.deps, access, live, signal: controller.signal })
      : undefined;
    if (publication)
      resources.push(async () => {
        publication.close();
        await publication.done;
      });
    let selections = 0;
    const retry = createProjectSyncRetry({
      refresh: async () => {},
      owners: {
        core: { get: () => core },
        activity: { get: () => activity },
        publications: { get: () => publication },
      },
      folders: {
        get: () => ({
          ...folder,
          retry() {
            folderRetries++;
            return folder.retry();
          },
          prepareRetry() {
            const retry = folder.prepareRetry();
            return () => {
              folderRetries++;
              return retry();
            };
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
          await Promise.all([core, publication, undefined, activity].map(readOwnerStatus)),
          [],
          [],
          await folder.folder(),
        ),
      async () => {},
      afterStatus
        ? async (project, selection, requireCurrent) => {
            let checks = 0;
            const scheduled = await retry(project, selection, async () => {
              await requireCurrent?.();
              if (++checks === 2) await afterStatus();
              await requireCurrent?.();
            });
            selections++;
            return scheduled;
          }
        : retry,
    );
    const api = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => host.app.fetch(request) });
    resources.push(() => api.stop(true));
    const close = async () => {
      traffic.core.finish.resolve();
      traffic.activity.finish.resolve();
      traffic.folder.finish.resolve();
      await dispose();
    };
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
    const expected = new URLSearchParams({ accountId: account.accountId, managerOrigin: account.managerOrigin });
    return {
      root,
      host,
      id,
      config,
      traffic,
      core,
      activity,
      folder,
      publication,
      live,
      api,
      retry,
      close,
      get folderRetries() {
        return folderRetries;
      },
      get selections() {
        return selections;
      },
      download: () => fetch(`${api.url.origin}/v1/account/projects/${id}/download?${expected}`, { method: "POST" }),
      canDownload: async () =>
        (await (await fetch(`${api.url.origin}/v1/account/projects`)).json()).projects.find(
          (p: { id: string }) => p.id === id,
        ).actions.download,
    };
  } catch (error) {
    await dispose().catch((cleanupError) => {
      throw new AggregateError([error, cleanupError], "Download fixture setup failed");
    });
    throw error;
  }
};

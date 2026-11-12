import type { SubscribeDocument } from "pstdio-sync/relay";
import {
  createDocumentRelay,
  createDocumentSync,
  createRecordStreamSync,
  type fetchSyncSpaces,
} from "pstdio-sync/relay";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createRelayDocumentJobs, RelayDocumentRetiredError } from "./document-jobs";
import { documentProgress } from "./document-progress";
import { createRelayLogs } from "./logs";
import { createSyncQuarantine } from "./quarantine";
import { traceDocumentProgress, traceDocumentSync, traceRecordStreamStore } from "./record-stream-progress";
import type { RelayWorkbench } from "./runtime";
import type { createSourceActivity } from "./source-activity";

export interface ExtensionDocumentSyncInput {
  config: RelayWorkbench;
  owner: { workbenchId: string; extensionId: string };
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  discoveryNeeded?: () => void;
  subscribe?: SubscribeDocument;
  statusChanged?: () => void;
}

export const initializeDocumentPass = async (
  input: ExtensionDocumentSyncInput,
  activity: ReturnType<typeof createSourceActivity>,
  signal: AbortSignal,
  space: Awaited<ReturnType<typeof fetchSyncSpaces>>["project"],
) => {
  activity.resetPending();
  const { config, owner, deps } = input;
  const controller = new AbortController();
  const workSignal = AbortSignal.any([signal, controller.signal]);
  const relay = (documentId: string) =>
    createDocumentRelay({
      subscribe: input.subscribe,
      origin: config.relayOrigin,
      space,
      documentId,
      signal: workSignal,
      token: async () => (await input.access()).token,
      progress: activity.network,
    });
  const quarantine = (documentId: string) =>
    createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId });
  const ownerId = await space.documentId(JSON.stringify([owner.extensionId, "owner"]));
  const recordStreamId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream-v2"]));
  let observation: Promise<ReturnType<typeof documentProgress>> | undefined;
  const statusChanged = () => {
    observation = undefined;
    input.statusChanged?.();
  };
  const logs = createRelayLogs({
    owner,
    space,
    service: deps.extensionStorageService.logs,
    relay,
    signal: workSignal,
    subscribe: input.subscribe,
    statusChanged,
  });
  const jobs = createRelayDocumentJobs({
    signal: workSignal,
    create: async (name) => {
      const documentId =
        name === "records" ? ownerId : await space.documentId(JSON.stringify([owner.extensionId, name]));
      const sync = createDocumentSync({
        owner,
        space,
        documentId,
        store: deps.extensionStorageService.documents.open(name),
        assets: createRecordAssets(deps.assetTransferService, owner, workSignal),
        relay: relay(documentId),
        quarantine: quarantine(documentId),
      });
      return { documentId, sync: traceDocumentSync(owner, name === "records" ? "directory" : "document", sync) };
    },
  });
  const records = createRecordStreamSync({
    space,
    documentId: recordStreamId,
    relay: relay(recordStreamId),
    store: traceRecordStreamStore(
      owner,
      deps.extensionStorageService.documents.recordStream(owner),
      activity,
      workSignal,
    ),
    assets: createRecordAssets(deps.assetTransferService, owner, workSignal),
    quarantine: quarantine(recordStreamId),
    fileProgress: activity.file,
  });
  let directory: string[] | undefined;
  let running: Promise<void> | undefined;
  const synchronizeDocument = async (name: string) => {
    statusChanged();
    try {
      return await activity.run("internal-document", () => jobs.synchronize(name), workSignal);
    } catch (error) {
      if (error === workSignal.reason && error instanceof RelayDocumentRetiredError) return true;
      throw error;
    } finally {
      statusChanged();
    }
  };
  const synchronize = () => {
    if (running) return running;
    const work = Promise.resolve().then(async () => {
      try {
        activity.start();
        directory = undefined;
        statusChanged();
        workSignal.throwIfAborted();
        await activity.run("discovering", () => deps.extensionStorageService.documents.list(owner), workSignal);
        workSignal.throwIfAborted();
        await activity.run("owner-directory", () => synchronizeDocument("records"), workSignal);
        workSignal.throwIfAborted();
        await activity.run("receiving-records", () => records.synchronize(), workSignal);
        await activity.run("publishing-logs", () => logs.publish(), workSignal);
        workSignal.throwIfAborted();
        directory = await activity.run(
          "discovering",
          () => deps.extensionStorageService.documents.list(owner),
          workSignal,
        );
        statusChanged();
        for (const name of directory) {
          workSignal.throwIfAborted();
          if (name !== "records") {
            await synchronizeDocument(name);
          }
        }
        activity.complete();
      } catch (error) {
        if (error !== workSignal.reason || !(error instanceof RelayDocumentRetiredError)) throw error;
      } finally {
        running = undefined;
      }
    });
    running = work;
    return work;
  };
  return {
    signal,
    generation: space.generation,
    jobs,
    logs,
    ownerId,
    recordStreamId,
    synchronizeDocument,
    invalidate(name?: string) {
      if (name && !directory?.includes(name)) directory = undefined;
      statusChanged();
    },
    status: () =>
      (observation ??= readStatus().catch((error) => {
        observation = undefined;
        throw error;
      })),
    synchronize,
    async close() {
      controller.abort(new RelayDocumentRetiredError("Document key generation retired"));
      await running?.catch(() => {});
      await jobs.close();
      await logs.close();
    },
  };
  async function readStatus() {
    const names = [...new Set(["records", ...jobs.names(), ...(directory ?? [])])];
    const statuses = [...(await jobs.statuses(names)), await records.status(), await logs.status()];
    traceDocumentProgress(owner, names, statuses);
    return documentProgress(statuses, directory !== undefined);
  }
};

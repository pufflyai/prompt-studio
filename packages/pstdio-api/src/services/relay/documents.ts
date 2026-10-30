import { createDocumentRelay, createDocumentSync, createRecordStreamSync, fetchSyncSpaces } from "pstdio-sync/relay";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createRelayDocumentJobs, RelayDocumentRetiredError } from "./document-jobs";
import { createSyncQuarantine } from "./quarantine";
import type { RelayWorkbench } from "./runtime";

export const createExtensionDocumentSync = (input: {
  config: RelayWorkbench;
  owner: { workbenchId: string; extensionId: string };
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  discoveryNeeded?: () => void;
}) => {
  const initialize = async (signal: AbortSignal, space: Awaited<ReturnType<typeof fetchSyncSpaces>>["project"]) => {
    const { config, owner, deps } = input;
    const controller = new AbortController();
    const workSignal = AbortSignal.any([signal, controller.signal]);
    const relay = (documentId: string) =>
      createDocumentRelay({
        origin: config.relayOrigin,
        space,
        documentId,
        signal: workSignal,
        token: async () => (await input.access()).token,
      });
    const quarantine = (documentId: string) =>
      createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId });
    const ownerId = await space.documentId(JSON.stringify([owner.extensionId, "owner"]));
    const recordStreamId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
    const jobs = createRelayDocumentJobs({
      signal: workSignal,
      create: async (name) => {
        const documentId =
          name === "records" ? ownerId : await space.documentId(JSON.stringify([owner.extensionId, name]));
        return {
          documentId,
          sync: createDocumentSync({
            owner,
            space,
            documentId,
            store: deps.extensionStorageService.documents.open(name),
            assets: createRecordAssets(deps.assetTransferService, owner, workSignal),
            relay: relay(documentId),
            quarantine: quarantine(documentId),
          }),
        };
      },
    });
    const records = createRecordStreamSync({
      space,
      documentId: recordStreamId,
      relay: relay(recordStreamId),
      store: deps.extensionStorageService.documents.recordStream(owner),
      assets: createRecordAssets(deps.assetTransferService, owner, workSignal),
      quarantine: quarantine(recordStreamId),
    });
    let recordStatus: Awaited<ReturnType<typeof records.status>> | undefined;
    let running: Promise<void> | undefined;
    const synchronize = () => {
      if (running) return running;
      const work = Promise.resolve().then(async () => {
        try {
          workSignal.throwIfAborted();
          await deps.extensionStorageService.documents.list(owner);
          workSignal.throwIfAborted();
          await jobs.synchronize("records");
          workSignal.throwIfAborted();
          await records.synchronize();
          workSignal.throwIfAborted();
          recordStatus = await records.status();
          for (const name of await deps.extensionStorageService.documents.list(owner)) {
            workSignal.throwIfAborted();
            if (name !== "records") await jobs.synchronize(name);
          }
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
      ownerId,
      recordStreamId,
      status: () => {
        const status = jobs.status();
        return {
          downloaded: status.downloaded && !!recordStatus?.downloaded,
          pending: status.pending || !!recordStatus?.pending,
          needsAttention: status.needsAttention || !!recordStatus?.needsAttention,
        };
      },
      synchronize,
      async close() {
        controller.abort(new RelayDocumentRetiredError("Document key generation retired"));
        await running?.catch(() => {});
        await jobs.close();
      },
    };
  };
  let current: Awaited<ReturnType<typeof initialize>> | undefined;
  let firstDownloaded = false;
  let preparing: { signal: AbortSignal; work: Promise<Awaited<ReturnType<typeof initialize>>> } | undefined;
  const starting = new Map<string, { signal: AbortSignal; work: Promise<boolean>; dirty: boolean }>();
  const close = async () => {
    const previous = current;
    current = undefined;
    await previous?.close();
  };
  const synchronizeDocument = (name: string, signal: AbortSignal) => {
    if (name === "records") return Promise.resolve(false);
    const previous = starting.get(name);
    if (previous?.signal === signal) {
      previous.dirty = true;
      return previous.work;
    }
    let request: { signal: AbortSignal; dirty: boolean; work: Promise<boolean> };
    const work = Promise.resolve().then(async () => {
      try {
        while (request.dirty) {
          request.dirty = false;
          const active = await prepare(signal);
          await active.jobs.synchronize(name);
          if (current !== active) request.dirty = true;
        }
        return true;
      } finally {
        if (starting.get(name)?.work === work) starting.delete(name);
      }
    });
    request = { signal, dirty: true, work };
    starting.set(name, request);
    return work;
  };
  const prepare = (signal: AbortSignal) => {
    if (preparing?.signal === signal) return preparing.work;
    const work = (async () => {
      const { config } = input;
      const { project: space } = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal });
      if (!current || current.signal !== signal || current.generation !== space.generation) {
        await close();
        signal.throwIfAborted();
        current = await initialize(signal, space);
        input.discoveryNeeded?.();
      }
      return current;
    })();
    preparing = { signal, work };
    void work
      .finally(() => {
        if (preparing?.work === work) preparing = undefined;
      })
      .catch(() => {});
    return work;
  };
  return {
    close,
    status: async () => ({
      firstDownloaded,
      ...(current?.status() ?? { downloaded: false, pending: false, needsAttention: false }),
    }),
    synchronizeDocument,
    prepare,
    hasDocument: (name: string) => !!current?.jobs.has(name),
    acceptsChange(change: Extract<LiveServerMessage, { type: "changed" }>) {
      const active = current;
      return (
        change.spaceOwner === null &&
        !!active &&
        (change.documentId === active.ownerId ||
          change.documentId === active.recordStreamId ||
          active.jobs.nameFor(change.documentId) !== undefined)
      );
    },
    synchronizeChanged(change: Extract<LiveServerMessage, { type: "changed" }>, signal: AbortSignal) {
      if (change.spaceOwner !== null) return Promise.resolve(true);
      const active = current;
      if (!active || active.signal !== signal) return Promise.resolve(false);
      if (change.documentId === active.ownerId || change.documentId === active.recordStreamId)
        return Promise.resolve(false);
      const name = active.jobs.nameFor(change.documentId);
      // Owner directory publication announces new names. Reconnect also reads that directory.
      // An opaque hint belonging to another owner must not sweep this owner.
      return name ? synchronizeDocument(name, signal) : Promise.resolve(true);
    },
    async synchronize(signal: AbortSignal) {
      const active = await prepare(signal);
      await active.synchronize();
      if (current === active && active.status().downloaded) firstDownloaded = true;
    },
  };
};

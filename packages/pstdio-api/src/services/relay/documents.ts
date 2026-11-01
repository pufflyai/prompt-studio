import type { SubscribeDocument } from "pstdio-sync/relay";
import { createDocumentRelay, createDocumentSync, createRecordStreamSync, fetchSyncSpaces } from "pstdio-sync/relay";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { documentProgress } from "./document-progress";
import { createSyncQuarantine } from "./quarantine";
import type { RelayWorkbench } from "./runtime";

export const createExtensionDocumentSync = (input: {
  config: RelayWorkbench;
  owner: { workbenchId: string; extensionId: string };
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  statusChanged?: () => void;
}) => {
  let attempt: AbortSignal | undefined;
  let generation: number | undefined;
  // Each reconnect replaces the document syncs. The first download stays done for this owner.
  let firstDownloaded = false;
  const documents = new Map<string, ReturnType<typeof createDocumentSync>>();
  let records: ReturnType<typeof createRecordStreamSync> | undefined;
  // This directory drives the active download loop; it is unknown before owner metadata arrives.
  let directory: string[] | undefined;
  const reset = () => {
    for (const document of documents.values()) document.close();
    documents.clear();
    records = undefined;
    directory = undefined;
  };
  const stop = input.deps.extensionStorageService.watch((owner) => {
    if (owner.workbenchId === input.owner.workbenchId && owner.extensionId === input.owner.extensionId) {
      directory = undefined;
      input.statusChanged?.();
    }
  });
  return {
    close() {
      stop();
      reset();
    },
    async status() {
      const statuses = await Promise.all([
        ...[...new Set(["records", ...documents.keys(), ...(directory ?? [])])].map((name) =>
          documents.get(name)?.status(),
        ),
        records?.status(),
      ]);
      return {
        firstDownloaded,
        ...documentProgress(statuses, directory !== undefined),
      };
    },
    async synchronize(signal: AbortSignal, subscribe?: SubscribeDocument) {
      directory = undefined;
      const { config, owner, deps } = input;
      const { project: space } = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal });
      if (attempt !== signal || generation !== space.generation) {
        reset();
        attempt = signal;
        generation = space.generation;
      }
      const relay = (documentId: string) =>
        createDocumentRelay({
          subscribe,
          origin: config.relayOrigin,
          space,
          documentId,
          signal,
          token: async () => (await input.access()).token,
        });
      const quarantine = (documentId: string) =>
        createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId });
      const synchronize = async (name: string) => {
        let sync = documents.get(name);
        if (!sync) {
          // Owner metadata uses a new relay name: relay copies from before ADR 0100 still hold records.
          const documentId = await space.documentId(
            JSON.stringify([owner.extensionId, name === "records" ? "owner" : name]),
          );
          sync = createDocumentSync({
            owner,
            space,
            documentId,
            store: deps.extensionStorageService.documents.open(name),
            assets: createRecordAssets(deps.assetTransferService, owner, signal),
            relay: relay(documentId),
            quarantine: quarantine(documentId),
          });
          documents.set(name, sync);
        }
        await sync.synchronize();
        input.statusChanged?.();
      };
      // Publish local text document names, then discover names downloaded with the records document.
      await deps.extensionStorageService.documents.list(owner);
      await synchronize("records");
      if (!records) {
        const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
        records = createRecordStreamSync({
          space,
          documentId,
          relay: relay(documentId),
          store: deps.extensionStorageService.documents.recordStream(owner),
          assets: createRecordAssets(deps.assetTransferService, owner, signal),
          quarantine: quarantine(documentId),
        });
      }
      await records.synchronize();
      directory = await deps.extensionStorageService.documents.list(owner);
      input.statusChanged?.();
      for (const name of directory) if (name !== "records") await synchronize(name);
      const statuses = await Promise.all([...documents.values(), records].map((sync) => sync.status()));
      if (statuses.every((status) => status.downloaded)) firstDownloaded = true;
    },
  };
};

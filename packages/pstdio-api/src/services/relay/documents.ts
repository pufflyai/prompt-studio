import { createDocumentRelay, createDocumentSync, fetchSyncSpaces } from "pstdio-sync/relay";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createSyncQuarantine } from "./quarantine";
import type { RelayWorkbench } from "./runtime";

export const createExtensionDocumentSync = (input: {
  config: RelayWorkbench;
  owner: { workbenchId: string; extensionId: string };
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
}) => {
  let attempt: AbortSignal | undefined;
  let generation: number | undefined;
  const documents = new Map<string, ReturnType<typeof createDocumentSync>>();
  const close = () => {
    for (const document of documents.values()) document.close();
    documents.clear();
  };
  return {
    close,
    async status() {
      const names = await input.deps.extensionStorageService.documents.list(input.owner);
      const statuses = await Promise.all(
        [...new Set(["records", ...names])].map((name) => documents.get(name)?.status()),
      );
      return {
        downloaded: statuses.every((status) => status?.downloaded),
        pending: statuses.some((status) => status?.pending),
        needsAttention: statuses.some((status) => status?.needsAttention),
      };
    },
    async synchronize(signal: AbortSignal) {
      const { config, owner, deps } = input;
      const { project: space } = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal });
      if (attempt !== signal || generation !== space.generation) {
        close();
        attempt = signal;
        generation = space.generation;
      }
      const synchronize = async (name: string) => {
        let sync = documents.get(name);
        if (!sync) {
          const documentId = await space.documentId(JSON.stringify([owner.extensionId, name]));
          sync = createDocumentSync({
            owner,
            space,
            documentId,
            store: deps.extensionStorageService.documents.open(name),
            assets: createRecordAssets(deps.assetTransferService, owner, signal),
            relay: createDocumentRelay({
              origin: config.relayOrigin,
              space,
              documentId,
              signal,
              token: async () => (await input.access()).token,
            }),
            quarantine: createSyncQuarantine({
              accountId: config.accountId,
              projectId: config.workbenchId,
              documentId,
            }),
          });
          documents.set(name, sync);
        }
        await sync.synchronize();
      };
      // Publish local text document names, then discover names downloaded with the records document.
      await deps.extensionStorageService.documents.list(owner);
      await synchronize("records");
      for (const name of await deps.extensionStorageService.documents.list(owner))
        if (name !== "records") await synchronize(name);
    },
  };
};

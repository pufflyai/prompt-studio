import type { LiveConnection } from "pstdio-sync/relay";
import { createDocumentRelayConnection } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createExtensionDocumentSync } from "./documents";
import type { RelayWorkbench } from "./runtime";

// Core-owned records sync independently of extension enablement, including their assets.
export const startCoreRecordSync = (input: {
  ownerId: string;
  live?: LiveConnection;
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  statusChanged: () => void;
}) => {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const owner = { workbenchId: input.config.workbenchId, extensionId: input.ownerId };
  const documents = createExtensionDocumentSync({
    ...input,
    owner,
    subscribe: (space, id) => connection.subscribe(space, id),
  });
  const connection = createDocumentRelayConnection({
    live: input.live,
    origin: input.config.relayOrigin,
    projectId: owner.workbenchId,
    signal,
    access: input.access,
    acceptsChange: documents.acceptsChange,
    synchronizeChanged: documents.synchronizeChanged,
    synchronize: documents.synchronize,
    onStatusChange: input.statusChanged,
  });
  const stop = input.deps.extensionStorageService.watch((changed) => {
    if (changed.workbenchId === owner.workbenchId && changed.extensionId === owner.extensionId) {
      connection.wake();
      input.statusChanged();
    }
  });
  return {
    wake: connection.wake,
    retry: connection.retry,
    restart: connection.restart,
    done: connection.done.finally(() => {
      stop();
      return documents.close();
    }),
    status: async () => ({ ...(await documents.status()), ...connection.status() }),
    close: () => controller.abort(),
  };
};

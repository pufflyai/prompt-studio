import { createDocumentRelayConnection } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { deviceAutomationsOwnerId } from "../../features/extensions/device-automations";
import { createExtensionDocumentSync } from "./documents";
import type { RelayWorkbench } from "./runtime";

// Automations are ordinary encrypted project records, independent of extension enablement.
export const startAutomationSync = (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  statusChanged: () => void;
}) => {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const owner = { workbenchId: input.config.workbenchId, extensionId: deviceAutomationsOwnerId };
  const documents = createExtensionDocumentSync({ ...input, owner });
  const connection = createDocumentRelayConnection({
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
    done: connection.done.finally(() => {
      stop();
      return documents.close();
    }),
    status: async () => ({ ...(await documents.status()), ...connection.status() }),
    close: () => controller.abort(),
  };
};

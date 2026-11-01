import type { ProjectRelayConnection } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { deviceAutomationsOwnerId } from "../../features/extensions/device-automations";
import { createExtensionDocumentSync } from "./documents";
import type { RelayWorkbench } from "./runtime";

// Automations are ordinary encrypted project records, independent of extension enablement.
export const startAutomationSync = (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  relay: ProjectRelayConnection;
  signal: AbortSignal;
  statusChanged: () => void;
}) => {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const owner = { workbenchId: input.config.workbenchId, extensionId: deviceAutomationsOwnerId };
  const documents = createExtensionDocumentSync({ ...input, owner, claim: (id) => connection.claim(id) });
  const connection = input.relay.attach({
    signal,
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
    done: connection.done.finally(() => {
      stop();
      documents.close();
    }),
    status: async () => ({ ...(await documents.status()), ...connection.status() }),
    close: () => controller.abort(),
  };
};

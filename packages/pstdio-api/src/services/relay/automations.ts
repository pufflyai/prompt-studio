import { createRelayAdapter, createRelayConnection } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { automationOwner, openAutomationCatalog } from "../../features/extensions/synchronized-automations/catalog";
import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "./runtime";

export const startSharedAutomations = async (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
}) => {
  const { config, deps, signal } = input;
  const owner = automationOwner(config.workbenchId);
  const catalog = await openAutomationCatalog(deps, config.workbenchId);
  const adapterFor = (signal: AbortSignal) =>
    createRelayAdapter({
      origin: config.relayOrigin,
      scope: { ...owner, accountId: config.accountId },
      token: async () => (await input.access()).token,
      signal,
    });
  const adapter = adapterFor(signal);
  const connection = createRelayConnection({
    origin: config.relayOrigin,
    scope: adapter.scope,
    signal,
    access: async () => {
      const issued = await input.access();
      await adapter.initialize("automations-v1");
      return issued;
    },
    synchronize: async (attemptSignal) => {
      await catalog.synchronize(adapterFor(attemptSignal));
      deps.eventBus.emit("automation_definitions", "set", { projectId: config.workbenchId });
    },
    onError: () =>
      apiLogger.warn(
        { event: "relay.automations.failed", workbenchId: config.workbenchId },
        "Automation delivery will retry",
      ),
  });
  return { ...connection, owner };
};

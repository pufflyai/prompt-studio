import { createRelayAdapter, createRelayConnection } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { activatePublication } from "../../features/extensions/publication/activate";
import { openPublishedCatalog, publicationSchema, publishedOwner } from "../../features/extensions/publication/catalog";
import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "./runtime";

export const startPublishedExtensions = async (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
}) => {
  const { config, deps, signal } = input;
  const owner = publishedOwner(config.workbenchId);
  const catalog = await openPublishedCatalog(deps, config.workbenchId, signal);
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
      await adapter.initialize("published-extensions-v1");
      return issued;
    },
    synchronize: async (attemptSignal) => {
      await catalog.synchronize(adapterFor(attemptSignal));
      // Pending publications and retained alternatives are never executable.
      const accepted = (await catalog.readState()).accepted;
      const failures: unknown[] = [];
      for (const record of Object.values(accepted?.records ?? {})) {
        if (record.deleted) continue;
        try {
          const publication = publicationSchema.parse(record.value);
          if (publication.extensionId !== record.recordId || !record.asset)
            throw new Error("Invalid published extension catalog");
          await activatePublication(deps, config.workbenchId, publication, record.asset, attemptSignal);
        } catch (error) {
          failures.push(error);
          apiLogger.warn(
            {
              event: "relay.publication.activation_failed",
              workbenchId: config.workbenchId,
              extensionId: record.recordId,
            },
            "Published extension could not activate",
          );
        }
      }
      if (failures.length) throw new AggregateError(failures, "Published extension activation will retry");
    },
    onError: () =>
      apiLogger.warn(
        { event: "relay.publication.failed", workbenchId: config.workbenchId },
        "Published extension catch-up will retry",
      ),
  });
  return { ...connection, owner };
};

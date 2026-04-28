import type { DbClient } from "pstdio-db";
import { runExtensionInitialSetup } from "pstdio-extensions";
import type { EventBus } from "../features/sync/event-bus";

type ExtensionSetupServiceDeps = {
  db: DbClient;
  eventBus: EventBus;
};

export const createExtensionSetupService = (deps: ExtensionSetupServiceDeps) => ({
  runFirstPartyInitialSetup: (projectId: string) =>
    runExtensionInitialSetup({
      db: deps.db,
      eventBus: deps.eventBus,
      projectId,
      includeLocal: false,
    }),
});

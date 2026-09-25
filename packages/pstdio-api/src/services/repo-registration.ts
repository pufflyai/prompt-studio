import {
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
  createReposDBService,
  createWorkspacesDBService,
  type DbClient,
} from "pstdio-db";
import { createProjectExtensionRuntimeCatalog } from "../features/extensions/project-extension-runtime-catalog";
import { EventBus, type SyncEvent } from "../features/sync/event-bus";
import { apiLogger } from "../lib/logger";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";
import { createWorkspaceService } from "./workspace-service";

const createRegistrationScope = (db: DbClient, eventBus: EventBus, changedSources: Set<string | undefined>) => {
  const reposDBService = createReposDBService(db);
  const installedExtensionSourcesService = createInstalledExtensionSourcesDBService(db);
  const projectService = createProjectService({ projectsDBService: createProjectsDBService(db), eventBus });
  const workspaceService = createWorkspaceService({ workspacesDb: createWorkspacesDBService(db), eventBus });
  const extensionService = createExtensionService({
    extensionInstancesService: createExtensionInstancesDBService(db),
    installedExtensionSourcesService,
    extensionUserDataService: createExtensionUserDataDBService(db),
    projectService,
    eventBus,
    onInstalledSourcesChanged: (path) => {
      changedSources.add(path);
    },
    validateResourcePrefixes: (projectId, source) => catalog.validateResourcePrefixes(projectId, source),
  });
  // Validation must read this transaction's discoveries, not the live catalog's cached state.
  const catalog = createProjectExtensionRuntimeCatalog({
    extensionService,
    projectService,
    repoService: reposDBService,
  });
  return {
    reposDBService,
    installedExtensionSourcesService,
    projectService,
    workspaceService,
    extensionService,
    eventBus,
  };
};

export type RepoRegistrationScope = ReturnType<typeof createRegistrationScope>;

export const createRepoRegistration =
  (deps: { db: DbClient; eventBus: EventBus; onInstalledSourcesChanged: (path?: string) => Promise<void> }) =>
  async <T>(initialize: (scope: RepoRegistrationScope) => Promise<T>) => {
    const events: SyncEvent[] = [];
    const eventBus = new EventBus();
    eventBus.subscribe((event) => events.push(event));
    const changedSources = new Set<string | undefined>();
    const result = await deps.db.transaction((tx) => initialize(createRegistrationScope(tx, eventBus, changedSources)));
    for (const event of events) deps.eventBus.emit(event.table, event.op, event.data);
    for (const path of changedSources) {
      try {
        await deps.onInstalledSourcesChanged(path);
      } catch (err) {
        // Runtime refresh follows the commit; its failure must not report registration as rejected.
        apiLogger.error(
          { err, event: "extensions.registration_refresh.failed", path },
          "Extension refresh failed after repository registration",
        );
      }
    }
    return result;
  };

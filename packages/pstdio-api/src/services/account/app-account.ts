import { accountEvents } from "pstdio-api-contracts/extension-kernel";
import type { AppConfig } from "../../app-config";
import type { RouteDeps } from "../../features/deps";
import { fireExtensionEventAsync } from "../../features/extensions/extension-event-runtime";
import { recoverCloudProject } from "../../features/projects/cloud-project-recovery";
import { connectAppRelay } from "../relay/runtime";
import { createNativeAccount, nativeAccountFile } from "./native-account";
import { createProjectSyncEvents } from "./project-sync-events";
import { startRecoveryCapture } from "./recovery-capture";

export const createAppAccount = (
  config: AppConfig,
  environment: RouteDeps["environmentService"],
  projects: RouteDeps["projectService"],
) => {
  const accountService = createNativeAccount({
    file: nativeAccountFile(config.database.path, config.storage.root, config.accountFile),
    environment,
    projects,
  });
  let stopEvents = () => {};
  let stopRecovery = async () => {};
  const connectAccountRelay = <T extends { deps: RouteDeps; close: () => Promise<void> }>(app: T) => {
    const syncEvents = createProjectSyncEvents({
      status: (projectId) => accountService.projectSyncStatus(projectId),
      publish: (projectId, status) =>
        fireExtensionEventAsync(app.deps, projectId, accountEvents.projectSyncChanged, { ...status, projectId }),
    });
    return connectAppRelay(
      {
        ...app,
        close: async () => {
          await stopRecovery();
          stopEvents();
          await syncEvents.close();
          await accountService.close();
          await app.close();
        },
      },
      {
        // A rejected renewal means this device or project left the account; refreshing finds out which.
        denied: () => void accountService.refresh(),
        statusChanged: (projectId) => void syncEvents.changed(projectId),
        ready: async (relay) => {
          // A project created or bound here may already be a cloud project of this account.
          stopEvents = app.deps.eventBus.subscribe((event) => {
            if (event.table === "projects") void accountService.refresh();
          });
          let cloudProjects: string[] = [];
          const recovery = startRecoveryCapture({
            recovery: app.deps.extensionStorageService.recovery,
            // A first point waits for the first full download, so it never holds a partial project.
            projects: async () => {
              const ready: string[] = [];
              for (const id of cloudProjects) if ((await relay.status(id)).offlineReady) ready.push(id);
              return ready;
            },
          });
          stopRecovery = recovery.close;
          accountService.start(
            async (connections) => {
              cloudProjects = connections.map((connection) => connection.workbenchId);
              await relay.update(connections);
              // Signing in or out, or a membership change, can change any project's state, including
              // projects that never synced: they move between local and offline.
              for (const project of await projects.list()) void syncEvents.changed(project.id);
            },
            relay.status,
            (connection, signal) => recoverCloudProject(app.deps, connection, signal),
            relay.retry,
          );
        },
      },
    );
  };
  return { accountService, connectAccountRelay };
};

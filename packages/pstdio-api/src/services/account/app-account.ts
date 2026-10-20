import type { AppConfig } from "../../app-config";
import type { RouteDeps } from "../../features/deps";
import { connectAppRelay } from "../relay/runtime";
import { createNativeAccount, nativeAccountFile } from "./native-account";

export const createAppAccount = (
  config: AppConfig,
  environment: RouteDeps["environmentService"],
  projects: RouteDeps["projectService"],
) => {
  const accountService = createNativeAccount({
    file: nativeAccountFile(config.database.path, config.storage.root, config.accountFile),
    managerOrigin: config.accountManagerOrigin,
    environment,
    projects,
  });
  let stopEvents = () => {};
  const connectAccountRelay = <T extends { deps: RouteDeps; close: () => Promise<void> }>(app: T) =>
    connectAppRelay(
      {
        ...app,
        close: async () => {
          stopEvents();
          accountService.close();
          await app.close();
        },
      },
      {
        // A rejected renewal means this device or project left the account; refreshing finds out which.
        denied: () => void accountService.refresh(),
        ready: async (relay) => {
          // A project created or bound here may already be a cloud project of this account.
          stopEvents = app.deps.eventBus.subscribe((event) => {
            if (event.table === "projects") void accountService.refresh();
          });
          accountService.start(relay.update, relay.status);
        },
      },
    );
  return { accountService, connectAccountRelay };
};

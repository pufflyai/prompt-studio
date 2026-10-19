import type { AppConfig } from "../../app-config";
import type { RouteDeps } from "../../features/deps";
import type { RelayWorkbench } from "../relay/config";
import { connectAppRelay } from "../relay/runtime";
import { createNativeAccount, nativeAccountPaths } from "./native-account";

export const createAppAccount = (
  config: AppConfig,
  environment: RouteDeps["environmentService"],
  project: RouteDeps["projectService"],
) => {
  const paths = nativeAccountPaths(config.database.path, config.storage.root, config.relay?.connectionsFile);
  let connectRelay: (connection: RelayWorkbench) => Promise<void> = async () => {
    throw new Error("Relay is starting");
  };
  const accountService = createNativeAccount({
    ...paths,
    environment,
    project,
    connected: (connection) => connectRelay(connection),
  });
  const connectAccountRelay = <T extends { deps: RouteDeps; close: () => Promise<void> }>(app: T) =>
    connectAppRelay(
      {
        ...app,
        close: async () => {
          accountService.close();
          await app.close();
        },
      },
      paths.connectionsFile,
      (connect) => {
        connectRelay = connect;
      },
    );
  return { accountService, connectAccountRelay };
};

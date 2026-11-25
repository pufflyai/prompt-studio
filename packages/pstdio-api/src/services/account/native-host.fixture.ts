import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createDb,
  createEnvironmentDBService,
  createExtensionStorageDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createAccountRoutes } from "../../features/account/routes";
import type { RelayWorkbench } from "../relay/runtime";
import { createNativeAccount, nativeAccountFile } from "./native-account";

// Exercise the real account routes and durable local owners without booting unrelated
// agents, terminals or extension discovery. Packaged smoke covers full-host wiring.
export const createAccountHostFixture = async (
  root: string,
  {
    databasePath = join(root, "db"),
    recoverTeamProjects = false,
  }: { databasePath?: string; recoverTeamProjects?: boolean } = {},
) => {
  const database = await createDb({ path: databasePath });
  const projects = createProjectsDBService(database.db);
  const environmentService = createEnvironmentDBService(database.db);
  const extensionStorageService = createExtensionStorageDBService(database.db);
  const file = nativeAccountFile(databasePath, join(root, "storage"));
  let synced: RelayWorkbench[] = [];
  const account = createNativeAccount({ file, projects, environment: environmentService });
  // No relay runs here, so a synced project never finishes its first download, and a cloud project
  // missing on this device cannot be recovered.
  account.start(
    async (connections) => {
      synced = connections;
    },
    async () => ({ state: "first-download-incomplete", offlineReady: false }),
    async (connection, signal, created) => {
      if (!recoverTeamProjects || !connection.userId) return;
      signal.throwIfAborted();
      await account.recordCloudDiscovery(connection, "Team notebook");
      await projects.create({ id: connection.workbenchId, name: "Team notebook" });
      created();
    },
    undefined,
    undefined,
    undefined,
    extensionStorageService.cloudReturn,
  );
  await account.refresh();
  const app = new OpenAPIHono().route("/v1", createAccountRoutes(account));
  return {
    app,
    account,
    file,
    projects,
    synced: () => synced,
    deps: { environmentService, extensionStorageService },
    close: async () => {
      await account.close();
      await database.close();
    },
  };
};

import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createDb,
  createEnvironmentDBService,
  createExtensionStorageDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createAccountRoutes } from "../../features/account/routes";
import type { RelayWorkbench } from "../relay/config";
import { createNativeAccount, nativeAccountPaths } from "./native-account";

// Exercise the real account routes and durable local owners without booting unrelated
// agents, terminals or extension discovery. Packaged smoke covers full-host wiring.
export const createAccountHostFixture = async (root: string) => {
  const database = await createDb({ path: join(root, "db") });
  const projects = createProjectsDBService(database.db);
  const environmentService = createEnvironmentDBService(database.db);
  const extensionStorageService = createExtensionStorageDBService(database.db);
  const activated = new Map<string, RelayWorkbench>();
  const account = createNativeAccount({
    ...nativeAccountPaths(join(root, "db"), join(root, "storage")),
    project: projects,
    environment: environmentService,
    connected: async (connection) => {
      activated.set(connection.workbenchId, connection);
    },
  });
  const app = new OpenAPIHono().route("/v1", createAccountRoutes(account));
  return {
    app,
    projects,
    activated,
    deps: { environmentService, extensionStorageService },
    close: async () => {
      account.close();
      await database.close();
    },
  };
};

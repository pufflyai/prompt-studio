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
export const createAccountHostFixture = async (root: string) => {
  const database = await createDb({ path: join(root, "db") });
  const projects = createProjectsDBService(database.db);
  const environmentService = createEnvironmentDBService(database.db);
  const extensionStorageService = createExtensionStorageDBService(database.db);
  const file = nativeAccountFile(join(root, "db"), join(root, "storage"));
  let synced: RelayWorkbench[] = [];
  const account = createNativeAccount({ file, projects, environment: environmentService });
  account.start(async (connections) => {
    synced = connections;
  });
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
      account.close();
      await database.close();
    },
  };
};

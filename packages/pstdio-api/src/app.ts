import { websocket } from "hono/bun";
import type { AppDependencies, CreateAppInput } from "./app-contracts";
import { logStartupPhase } from "./lib/startup-phase";
import { openAppDatabase } from "./open-app-database";
import { createUpgradeBundleWarmup } from "./startup/warm-installed-upgrade-bundles";

export const apiWebSocket = websocket;
export type { AppConfig, ExtensionRelease } from "./app-config";
export { resolveAppConfig } from "./app-config";
export type { AppDependencies, AppHost, AppLifecycle, CreateAppInput } from "./app-contracts";
export { closeBeforeFatalExit } from "./fatal-close";
export { disableExtensionPreparationTimeout } from "./features/extensions/extension-request-timeout";
export { assertListenHostAllowed } from "./listen-host";

export const createApp = async (input: CreateAppInput, dependencies?: AppDependencies) => {
  const warming = createUpgradeBundleWarmup(input.config.extensions.release);
  try {
    let services: Promise<typeof import("./app-services")> | undefined;
    const database = await openAppDatabase(
      input.config.database.path,
      {
        onDatabaseLockAcquired() {
          input.lifecycle?.onDatabaseLockAcquired?.();
          services = import("./app-services");
          // Opening owns the worker until the service graph is ready or its import fails.
          void services.catch(() => {});
        },
      },
      input.config.storage.root,
      warming.start,
    );
    // Installs now take priority. Keep completed cache entries and stop speculative work.
    warming.stop();
    try {
      const app = await (await services!).buildApp(input, dependencies, database);
      logStartupPhase("app_ready");
      return app;
    } catch (error) {
      await database.close();
      throw error;
    }
  } finally {
    await warming.close();
  }
};

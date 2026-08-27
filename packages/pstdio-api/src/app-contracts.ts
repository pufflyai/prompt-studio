import type { AppConfig } from "./app-config";
import type { ConnectionSecretStore } from "./features/extensions/connection-secret-store";
import type { installExtensionSource } from "./features/extensions/install-extension-source";
import type { createHarnessRegistryService } from "./features/harnesses/harness-registry-service";
import type { RuntimeHost } from "./features/runtime/routes";

export type AppHost = { kind: "standalone"; token?: string } | { kind: "runtime"; runtime: RuntimeHost };

export interface AppLifecycle {
  onDatabaseLockAcquired?: () => void;
}

export interface AppDependencies {
  createHarnessRegistry: typeof createHarnessRegistryService;
  installExtensionSource: typeof installExtensionSource;
  connectionSecretStore?: ConnectionSecretStore;
}

export interface CreateAppInput {
  config: AppConfig;
  host: AppHost;
  lifecycle?: AppLifecycle;
}

import type { ConnectionSecretStore } from "./features/extensions/connection-secret-store";
import type { installExtensionSource } from "./features/extensions/install-extension-source";
import type { HarnessRegistryService } from "./features/harnesses/harness-registry-service";
import type { RuntimeHost } from "./features/runtime/routes";

export interface AppOptions {
  dbPath?: string;
  storagePath?: string;
  filesRoot: string;
  apiToken?: string;
  eventBusBufferSize?: number;
  extensionWebviewBuilds?: boolean;
  harnessRegistry?: HarnessRegistryService;
  runtimeHost?: RuntimeHost;
  extensionReleaseRef?: string;
  extensionSourceRoot?: string;
  installExtensionSource?: typeof installExtensionSource;
  terminalOrigins?: string[];
  onDatabaseLockAcquired?: () => void;
  connectionSecretStore?: ConnectionSecretStore;
  automationRunsPerMinute?: number;
}

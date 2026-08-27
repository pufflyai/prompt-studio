import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app";
import type { ExtensionRelease } from "../app-config";
import type { AppHost, AppLifecycle } from "../app-contracts";
import type { ConnectionSecretStore } from "../features/extensions/connection-secret-store";
import { installExtensionSource } from "../features/extensions/install-extension-source";
import {
  createHarnessRegistryService,
  type HarnessRegistryService,
} from "../features/harnesses/harness-registry-service";

export interface TestAppOptions {
  databasePath?: string;
  storageRoot?: string;
  eventBufferSize?: number;
  automationRunsPerMinute?: number;
  buildWebviews?: boolean;
  release?: ExtensionRelease | null;
  terminalOrigins?: string[];
  host?: AppHost;
  lifecycle?: AppLifecycle;
  harnessRegistry?: HarnessRegistryService;
  installExtensionSource?: typeof installExtensionSource;
  connectionSecretStore?: ConnectionSecretStore;
}

export const createTestApp = async (options: TestAppOptions = {}) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-test-app-"));
  const harnessRegistry = options.harnessRegistry;
  try {
    const handle = await createApp(
      {
        config: {
          database: { path: options.databasePath ?? ":memory:" },
          storage: { root: options.storageRoot ?? join(tempRoot, "storage") },
          sync: { eventBufferSize: options.eventBufferSize ?? 1000 },
          automation: { runsPerMinute: options.automationRunsPerMinute ?? 60 },
          extensions: {
            buildWebviews: options.buildWebviews ?? false,
            release: options.release ?? null,
          },
          transport: { terminalOrigins: options.terminalOrigins ?? [] },
        },
        host: options.host ?? { kind: "standalone" },
        lifecycle: options.lifecycle,
      },
      {
        createHarnessRegistry: harnessRegistry ? () => harnessRegistry : createHarnessRegistryService,
        installExtensionSource: options.installExtensionSource ?? installExtensionSource,
        connectionSecretStore: options.connectionSecretStore,
      },
    );
    const closeApp = handle.close;

    return {
      ...handle,
      close: async () => {
        try {
          await closeApp();
        } finally {
          rmSync(tempRoot, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
};

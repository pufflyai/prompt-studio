import type { HarnessProvider } from "@pstdio/sdk/extensions";
import type { AgentAvailabilityType } from "pstdio-api-contracts";
import { createHarnessRegistry } from "pstdio-api-runtime-host";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import type { HarnessRegistryService } from "./harness-registry-service";

// Test support: an in-memory harness registry mirroring the namespaced ids the
// real extension-backed registry produces.
export const testHarnessId = (localId: string) => `pstdio.pstdio-${localId}.${localId}`;

export const createTestHarnessRecord = (
  localId: string,
  options?: { availability?: AgentAvailabilityType; provider?: Partial<HarnessProvider> },
): RuntimeHarnessRecord => {
  const provider: HarnessProvider = {
    id: localId,
    label: { $l10n: `harness.${localId}`, default: localId },
    capabilities: () => [],
    detect: () => ({ available: (options?.availability ?? "INSTALLED") === "INSTALLED" }),
    listModels: () => [],
    start: () => ({ done: Promise.resolve({ status: "completed" as const }), stop: () => {} }),
    resume: () => ({ done: Promise.resolve({ status: "completed" as const }), stop: () => {} }),
    ...options?.provider,
  };

  return {
    id: testHarnessId(localId),
    localId,
    extensionId: `pstdio.pstdio-${localId}`,
    name: `pstdio-${localId}`,
    sourcePath: `/test/pstdio-${localId}/extension.ts`,
    provider,
  };
};

export const createTestHarnessRegistry = (
  records: RuntimeHarnessRecord[],
  options?: { disabledByProject?: Record<string, string[]> },
): HarnessRegistryService => {
  const registry = createHarnessRegistry(records, (record, options) => ({
    projectId: options?.projectId,
    extensionId: record.extensionId,
    name: record.name,
    process: {
      run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      spawnDetached: async () => ({}),
    },
    net: { findFreePort: async () => 0 },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  }));

  const isDisabled = (id: string, projectId?: string) =>
    Boolean(projectId && options?.disabledByProject?.[projectId]?.includes(id));

  return {
    list: async (scope) => registry.list().filter((handle) => !isDisabled(handle.id, scope?.projectId)),
    get: async (id, scope) => (isDisabled(id, scope?.projectId) ? null : registry.get(id)),
  };
};

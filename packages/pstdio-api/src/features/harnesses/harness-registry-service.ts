import { isLocalizedString } from "@pstdio/sdk/extensions";
import type { AgentAvailabilityType } from "pstdio-api-contracts";
import type { HarnessContextFactory, HarnessHandle } from "pstdio-api-runtime-host";
import { createHarnessRegistry } from "pstdio-api-runtime-host";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { createProcessApi, findFreePort } from "../extensions/extension-process-api";
import { selectExistingSources } from "../extensions/installed-extension-runtime";

export type HarnessRegistryService = {
  list(): Promise<HarnessHandle[]>;
  get(id: string): Promise<HarnessHandle | null>;
  /** Drops the cached registry; the next call reloads installed extension sources. */
  invalidate(): void;
};

export const resolveHarnessName = (handle: Pick<HarnessHandle, "label" | "localId">) => {
  if (isLocalizedString(handle.label)) return handle.label.default ?? handle.label.$l10n;
  return handle.label;
};

export const toAvailabilityInfo = (detection: { available: boolean }): { type: AgentAvailabilityType } => ({
  type: detection.available ? "INSTALLED" : "NOT_FOUND",
});

const harnessLogger = (extensionId: string) => ({
  info: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.info({ ...metadata, extension_id: extensionId }, message),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.warn({ ...metadata, extension_id: extensionId }, message),
  error: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.error({ ...metadata, extension_id: extensionId }, message),
});

// Harnesses are host-wide like the agent configs they back: the registry is the union of
// all installed extension sources; per-project enablement stays with projects.selected_agents.
export const createHarnessRegistryService = (input: {
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
}): HarnessRegistryService => {
  let cached: Promise<ReturnType<typeof createHarnessRegistry>> | null = null;

  const buildContext: HarnessContextFactory = (record, options) => ({
    projectId: options?.projectId,
    extensionId: record.extensionId,
    name: record.name,
    process: createProcessApi(),
    net: { findFreePort: async (portInput) => findFreePort(portInput?.host) },
    logger: harnessLogger(record.extensionId),
  });

  const build = async () => {
    const sources = selectExistingSources(await input.installedExtensionSourcesService.list());
    const loaded = await loadExtensionSources({
      extensionPackages: sources.map((source) => ({ path: source.source_path, sourceKind: source.source_kind })),
    });
    const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
    const registry = createHarnessRegistry(runtime.harnesses, buildContext);

    for (const id of registry.duplicates) {
      apiLogger.warn({ event: "harness.duplicate_id", harness_id: id }, "Duplicate harness id; last install wins");
    }

    return registry;
  };

  const resolve = () => {
    cached ??= build();
    return cached;
  };

  return {
    list: async () => (await resolve()).list(),
    get: async (id) => (await resolve()).get(id),
    invalidate: () => {
      cached = null;
    },
  };
};

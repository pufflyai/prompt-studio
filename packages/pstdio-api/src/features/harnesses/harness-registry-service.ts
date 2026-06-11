import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentAvailabilityType } from "pstdio-api-contracts";
import { isLocalizedString } from "pstdio-api-contracts/extension-kernel";
import type { HarnessContextFactory, HarnessHandle } from "pstdio-api-runtime-host";
import { createHarnessRegistry } from "pstdio-api-runtime-host";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { createProcessApi, findFreePort } from "../extensions/extension-process-api";
import { resolvePstdioHome } from "../extensions/install-extension-source";
import { selectExistingSources } from "../extensions/installed-extension-runtime";

export type HarnessScopeOptions = {
  /** Restrict to harnesses from extensions enabled for this project. */
  projectId?: string;
};

export type HarnessRegistryService = {
  list(options?: HarnessScopeOptions): Promise<HarnessHandle[]>;
  get(id: string, options?: HarnessScopeOptions): Promise<HarnessHandle | null>;
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

type EnabledSourcesLister = {
  listEnabledSourcesForProject(projectId: string): Promise<Array<{ installedSource: SourceRow }>>;
};

type SourceRow = { source_path: string; source_kind: "local_path" | "git" | "registry" };

// Host-wide, the registry is the union of everything in the user extensions root plus
// registered sources. Project-scoped calls see only extensions enabled for that project.
export const createHarnessRegistryService = (input: {
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  extensionService: EnabledSourcesLister;
}): HarnessRegistryService => {
  const buildContext: HarnessContextFactory = (record, options) => ({
    projectId: options?.projectId,
    extensionId: record.extensionId,
    name: record.name,
    process: createProcessApi(),
    net: { findFreePort: async (portInput) => findFreePort(portInput?.host) },
    logger: harnessLogger(record.extensionId),
  });

  // Sources registered in the DB only exist once a project synced them, but agents are
  // host-wide and must resolve before the first project: also scan the user extensions root.
  const listUserRootExtensionPaths = () => {
    const root = join(resolvePstdioHome({ env: process.env }), "extensions");
    try {
      return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(root, entry.name));
    } catch {
      return [];
    }
  };

  const listScopedPaths = async (options?: HarnessScopeOptions) => {
    if (options?.projectId) {
      const enabled = await input.extensionService.listEnabledSourcesForProject(options.projectId);
      return new Map(enabled.map(({ installedSource }) => [installedSource.source_path, installedSource.source_kind]));
    }

    const sources = selectExistingSources(await input.installedExtensionSourcesService.list());
    const paths = new Map<string, "local_path" | "git" | "registry">(
      listUserRootExtensionPaths().map((path) => [path, "local_path"]),
    );
    for (const source of sources) {
      paths.set(source.source_path, source.source_kind);
    }
    return paths;
  };

  const build = async (options?: HarnessScopeOptions) => {
    const paths = await listScopedPaths(options);
    const loaded = await loadExtensionSources({
      extensionPackages: [...paths.entries()].map(([path, sourceKind]) => ({ path, sourceKind })),
    });
    const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
    const registry = createHarnessRegistry(runtime.harnesses, buildContext);

    for (const id of registry.duplicates) {
      apiLogger.warn({ event: "harness.duplicate_id", harness_id: id }, "Duplicate harness id; last install wins");
    }

    return registry;
  };

  // Built per call: extension installs and enablement change at startup, on project
  // create, and via watchers; the loader's content-hashed caches keep rebuilds cheap.
  return {
    list: async (options) => (await build(options)).list(),
    get: async (id, options) => (await build(options)).get(id),
  };
};

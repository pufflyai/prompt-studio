import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentAvailabilityType } from "pstdio-api-contracts";
import { isLocalizedString } from "pstdio-api-contracts/extension-kernel";
import type { HarnessContextFactory, HarnessHandle, HarnessRegistry } from "pstdio-api-runtime-host";
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
  /** Drop cached registries so the next call rebuilds. Call when extension sources reload in place. */
  invalidate(): void;
};

type SourceKind = SourceRow["source_kind"];

type BuildRegistryInput = {
  paths: Map<string, SourceKind>;
  options?: HarnessScopeOptions;
};

// `detect()` shells out to `<cli> --version`; reuse a probe across a burst of
// `/agents/info` polls instead of spawning one process per request.
const DETECT_CACHE_TTL_MS = 5_000;

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
  /** Override the expensive load+normalize+build. Tests inject a counting fake. */
  buildRegistry?: (input: BuildRegistryInput) => Promise<HarnessRegistry>;
  /** Clock for the detect() TTL memo; defaults to Date.now. */
  now?: () => number;
  detectCacheTtlMs?: number;
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

  const defaultBuildRegistry = async ({ paths }: BuildRegistryInput) => {
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

  const buildRegistry = input.buildRegistry ?? defaultBuildRegistry;
  const now = input.now ?? Date.now;
  const detectCacheTtlMs = input.detectCacheTtlMs ?? DETECT_CACHE_TTL_MS;

  // Re-evaluate each handle's `detect()` at most once per TTL so polling endpoints
  // don't spawn `<cli> --version` on every request.
  const withDetectCache = (registry: HarnessRegistry): HarnessRegistry => {
    const detectCache = new Map<string, { at: number; result: ReturnType<HarnessHandle["detect"]> }>();
    const wrap = (handle: HarnessHandle): HarnessHandle => ({
      ...handle,
      detect: (detectOptions) => {
        const key = `${handle.id}:${detectOptions?.projectId ?? ""}`;
        const cached = detectCache.get(key);
        if (cached && now() - cached.at < detectCacheTtlMs) return cached.result;
        const result = handle.detect(detectOptions);
        detectCache.set(key, { at: now(), result });
        return result;
      },
    });

    const handles = new Map(registry.list().map((handle) => [handle.id, wrap(handle)]));
    return {
      duplicates: registry.duplicates,
      list: () => [...handles.values()],
      get: (id) => handles.get(id) ?? null,
    };
  };

  // The scoped path set fully determines the registry, so reuse the build until that
  // set changes (install/enable/uninstall) or `invalidate()` bumps the generation
  // (in-place source reloads, which keep the same paths).
  const cache = new Map<string, { signature: string; registry: HarnessRegistry }>();
  let generation = 0;

  const scopeKey = (options?: HarnessScopeOptions) => options?.projectId ?? "__host__";

  const signatureOf = (paths: Map<string, SourceKind>) =>
    `${[...paths.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, kind]) => `${path}:${kind}`)
      .join("|")}#${generation}`;

  const resolveRegistry = async (options?: HarnessScopeOptions) => {
    const paths = await listScopedPaths(options);
    const signature = signatureOf(paths);
    const key = scopeKey(options);
    const cached = cache.get(key);
    if (cached && cached.signature === signature) return cached.registry;

    const registry = withDetectCache(await buildRegistry({ paths, options }));
    cache.set(key, { signature, registry });
    return registry;
  };

  return {
    list: async (options) => (await resolveRegistry(options)).list(),
    get: async (id, options) => (await resolveRegistry(options)).get(id),
    invalidate: () => {
      generation += 1;
    },
  };
};

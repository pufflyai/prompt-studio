import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentAvailabilityType } from "pstdio-api-contracts";
import { type ExtensionConnectionsApi, isLocalizedString } from "pstdio-api-contracts/extension-kernel";
import type { HarnessContextFactory, HarnessHandle, HarnessRegistry } from "pstdio-api-runtime-host";
import { createHarnessRegistry } from "pstdio-api-runtime-host";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { installDefaultExtensions } from "../extensions/default-extensions";
import { createProcessApi, findFreePort } from "../extensions/extension-process-api";
import { resolvePstdioHome } from "../extensions/install-extension-source";
import { selectExistingSources } from "../extensions/installed-extension-runtime";
import type { ProjectExtensionRuntimeCatalog } from "../extensions/project-extension-runtime-catalog";
import type { ProjectExtensionRuntimeSnapshot } from "../extensions/project-extension-runtime-snapshot";
import { createHarnessRegistryLifecycle } from "./harness-registry-lifecycle";
import { createHarnessStateApi } from "./harness-state";

export type HarnessScopeOptions = {
  /** Restrict to harnesses from extensions enabled for this project. */
  projectId?: string;
};

export type HarnessRegistryService = {
  list(options?: HarnessScopeOptions): Promise<HarnessHandle[]>;
  get(id: string, options?: HarnessScopeOptions): Promise<HarnessHandle | null>;
  /** Drop the host-wide registry so the next call rebuilds. Call when extension sources reload in place. */
  invalidate(): void;
  dispose(): Promise<void>;
};

type SourceKind = "local_path" | "git" | "registry";

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

export const toAvailabilityInfo = (detection: {
  available: boolean;
  reason?: string;
}): { type: AgentAvailabilityType; reason?: string } => ({
  type: detection.available ? "INSTALLED" : "NOT_FOUND",
  ...(detection.reason ? { reason: detection.reason } : {}),
});

const harnessLogger = (extensionId: string) => ({
  info: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.info({ ...metadata, extension_id: extensionId }, message),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.warn({ ...metadata, extension_id: extensionId }, message),
  error: (message: string, metadata?: Record<string, unknown>) =>
    apiLogger.error({ ...metadata, extension_id: extensionId }, message),
});

// Project-scoped calls resolve harnesses from the project's runtime snapshot, so
// they observe the same catalog generation as every other extension consumer.
// The host-wide union (no projectId) is not an enabled-project runtime and keeps
// its own loading over the user extensions root plus registered sources.
export const createHarnessRegistryService = (input: {
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  extensionRuntimeCatalog: Pick<ProjectExtensionRuntimeCatalog, "get" | "subscribeInvalidation">;
  /** Override the expensive host-scope load+normalize+build. Tests inject a counting fake. */
  buildRegistry?: (input: BuildRegistryInput) => Promise<HarnessRegistry>;
  installDefaultExtensions?: typeof installDefaultExtensions;
  /** Clock for the detect() TTL memo; defaults to Date.now. */
  now?: () => number;
  detectCacheTtlMs?: number;
  createConnectionsApi?: (scope: { projectId: string; extensionId: string }) => ExtensionConnectionsApi;
}): HarnessRegistryService => {
  const unavailableConnections: ExtensionConnectionsApi = {
    request: async () => {
      throw new Error("Extension connections are not available in this host.");
    },
    stream: async function* () {
      yield await Promise.reject(new Error("Extension connections are not available in this host."));
    },
  };
  const buildContext: HarnessContextFactory = (record, options) => ({
    projectId: options?.projectId,
    extensionId: record.extensionId,
    name: record.name,
    process: createProcessApi(),
    net: { findFreePort: async (portInput) => findFreePort(portInput?.host) },
    connections:
      options?.projectId && input.createConnectionsApi
        ? input.createConnectionsApi({ projectId: options.projectId, extensionId: record.extensionId })
        : unavailableConnections,
    logger: harnessLogger(record.extensionId),
    state: createHarnessStateApi(record.extensionId),
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

  const listHostPaths = async () => {
    const sources = selectExistingSources(await input.installedExtensionSourcesService.list());
    const paths = new Map<string, SourceKind>(listUserRootExtensionPaths().map((path) => [path, "local_path"]));
    for (const source of sources) {
      paths.set(source.source_path, source.source_kind);
    }
    return paths;
  };

  const defaultBuildRegistry = async ({ paths }: BuildRegistryInput) => {
    ensureActive();
    const generation = resolutionGeneration;
    const loaded = await loadExtensionSources({
      extensionPackages: [...paths.entries()].map(([path, sourceKind]) => ({ path, sourceKind })),
    });
    if (generation !== resolutionGeneration) return null;
    const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics);
    return lifecycle.get(runtime.harnesses);
  };

  const lifecycle = createHarnessRegistryLifecycle((records) => createHarnessRegistry(records, buildContext));
  let closed = false;
  let resolutionGeneration = 0;
  const ensureActive = () => {
    if (closed) throw new Error("Harness registry has been disposed.");
  };

  const buildRegistry = input.buildRegistry ?? defaultBuildRegistry;
  const installDefaults = input.installDefaultExtensions ?? installDefaultExtensions;
  const now = input.now ?? Date.now;
  const detectCacheTtlMs = input.detectCacheTtlMs ?? DETECT_CACHE_TTL_MS;
  let defaultExtensionsInstall: Promise<void> | null = null;

  const ensureDefaultExtensionsInstalled = async () => {
    defaultExtensionsInstall ??= (async () => {
      try {
        await installDefaults({
          forceSourceDefaults: false,
          onInstallFailure: ({ error, installName, source }) => {
            apiLogger.warn(
              {
                err: error,
                event: "harness.default_extension_install.warning",
                extension: installName,
                source,
              },
              "Default extension install failed before harness listing",
            );
          },
        });
      } catch (err) {
        apiLogger.warn(
          { err, event: "harness.default_extension_install.error" },
          "Default extension install failed before harness listing",
        );
      }
    })();

    await defaultExtensionsInstall;
  };

  // Re-evaluate each handle's `detect()` at most once per TTL so polling endpoints
  // don't spawn `<cli> --version` on every request.
  const createRegistryView = (registry: HarnessRegistry): HarnessRegistry => {
    for (const id of registry.duplicates) {
      apiLogger.warn({ event: "harness.duplicate_id", harness_id: id }, "Duplicate harness id; last install wins");
    }
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
      dispose: () => registry.dispose(),
    };
  };

  // A derived view of the current snapshot, keyed by snapshot identity. It holds
  // no invalidation logic of its own: a new catalog generation is a new snapshot
  // object, which rebuilds the handles while keeping the detect() memo per build.
  const projectRegistries = new Map<string, { snapshot: ProjectExtensionRuntimeSnapshot; registry: HarnessRegistry }>();

  const projectLoads = new Map<string, Promise<HarnessRegistry>>();
  const loadProjectRegistry = async (projectId: string) => {
    for (;;) {
      ensureActive();
      const generation = resolutionGeneration;
      const snapshot = await input.extensionRuntimeCatalog.get(projectId);
      const cached = projectRegistries.get(projectId);
      if (cached && cached.snapshot === snapshot) return cached.registry;
      const loaded = await lifecycle.get(snapshot.runtime.harnesses, projectId);
      ensureActive();
      if (generation !== resolutionGeneration) continue;
      const registry = createRegistryView(loaded);
      projectRegistries.set(projectId, { snapshot, registry });
      return registry;
    }
  };
  const resolveProjectRegistry = (projectId: string) => {
    let loading = projectLoads.get(projectId);
    if (!loading) {
      loading = loadProjectRegistry(projectId).finally(() => projectLoads.delete(projectId));
      projectLoads.set(projectId, loading);
    }
    return loading;
  };

  // The host path set fully determines the registry, so reuse the build until that
  // set changes (install/uninstall) or `invalidate()` bumps the generation
  // (in-place source reloads, which keep the same paths).
  let hostCache: { signature: string; registry: HarnessRegistry } | null = null;
  let hostGeneration = 0;

  const hostSignatureOf = (paths: Map<string, SourceKind>) =>
    `${[...paths.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, kind]) => `${path}:${kind}`)
      .join("|")}#${hostGeneration}`;

  let hostLoad: Promise<HarnessRegistry> | undefined;
  const loadHostRegistry = async () => {
    for (;;) {
      ensureActive();
      const generation = resolutionGeneration;
      await ensureDefaultExtensionsInstalled();
      const paths = await listHostPaths();
      const signature = hostSignatureOf(paths);
      if (hostCache && hostCache.signature === signature) return hostCache.registry;
      const loaded = await buildRegistry({ paths });
      ensureActive();
      if (!loaded || generation !== resolutionGeneration) continue;
      const registry = createRegistryView(loaded);
      hostCache = { signature, registry };
      return registry;
    }
  };
  const resolveHostRegistry = () => {
    hostLoad ??= loadHostRegistry().finally(() => {
      hostLoad = undefined;
    });
    return hostLoad;
  };

  const resolveRegistry = (options?: HarnessScopeOptions) => {
    if (options?.projectId) return resolveProjectRegistry(options.projectId);
    return resolveHostRegistry();
  };

  const unsubscribe = input.extensionRuntimeCatalog.subscribeInvalidation((change) => {
    resolutionGeneration += 1;
    if (change.reason === "source_changed") lifecycle.invalidate({ sourcePath: change.sourcePath });
    if (change.reason === "project_workspace_changed") lifecycle.invalidate({ projectId: change.projectId });
    if (change.reason === "webviews_built") return;
    hostGeneration += 1;
    const projects = [...projectRegistries.keys()].filter((id) => !change.projectId || id === change.projectId);
    for (const id of projects) projectRegistries.delete(id);
    // Disablement must release workers even if the user never sends another turn.
    for (const projectId of projects) {
      resolveProjectRegistry(projectId).catch((err) => {
        if (!closed)
          apiLogger.error({ err, event: "harness.cleanup.error", project_id: projectId }, "Harness refresh failed");
      });
    }
    if (hostCache)
      resolveHostRegistry().catch((err) => {
        if (!closed) apiLogger.error({ err, event: "harness.cleanup.error" }, "Host harness refresh failed");
      });
  });

  return {
    list: async (options) => (await resolveRegistry(options)).list(),
    get: async (id, options) => (await resolveRegistry(options)).get(id),
    invalidate: () => {
      hostGeneration += 1;
      resolutionGeneration += 1;
    },
    dispose: async () => {
      closed = true;
      unsubscribe();
      const results = await Promise.allSettled([lifecycle.dispose(), hostCache?.registry.dispose()]);
      const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "Harness registry cleanup failed.");
    },
  };
};

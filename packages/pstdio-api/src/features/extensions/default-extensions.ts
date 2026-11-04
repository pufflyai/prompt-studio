import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { readPackageManifestMetadata } from "pstdio-extensions";
import { resolvePstdioHome } from "pstdio-paths";
import { traceSetupPhase } from "../../lib/setup-phase";
import {
  sourceFor,
  sourceModeDefaultEntry,
  toInstallInput,
  withResolvedDefaultEntries,
} from "./default-extension-entries";
import { enqueueDefaultExtensionInstall } from "./default-extension-install-queue";
import {
  type DefaultExtensionEntry,
  type DefaultExtensionsConfig,
  resolveDefaultExtensionsConfig,
} from "./default-extensions-config";
import { loadExtensionCatalog } from "./extension-catalog";
import { shouldInstallDependencies } from "./install-extension-dependencies";
import {
  type createSharedNamedSourceCheckout,
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  installExtensionSource,
} from "./install-extension-source";

export {
  type DefaultExtensionEntry,
  type DefaultExtensionsConfig,
  resolveDefaultExtensionsConfig,
} from "./default-extensions-config";
export { syncInstalledExtensionsForProject, syncInstalledExtensionsForProjects } from "./installed-extension-sync";

type InstallDefaultExtensionsDeps = {
  config?: DefaultExtensionsConfig;
  env?: Record<string, string | undefined>;
  forceSourceDefaults?: boolean;
  installNames?: string[];
  installExtensionSource?: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  onInstallFailure?: (failure: { error: unknown; installName: string; source: string }) => void;
  prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
  releaseRef?: string;
  signal?: AbortSignal;
};

type DefaultExtensionInstallMode = "refresh" | "ensure";

const needsDefaultExtensionInstall = (
  entry: DefaultExtensionEntry,
  extensionsRoot: string,
  mode: DefaultExtensionInstallMode,
) => {
  if (mode === "refresh" && typeof entry !== "string" && entry.force) return true;
  if (!isInstalledUserExtension(entry, extensionsRoot)) return true;
  const installName = typeof entry === "string" ? entry : (entry.installName ?? basename(entry.source));
  const targetPath = join(extensionsRoot, installName);
  const { manifest } = readPackageManifestMetadata(targetPath);
  if (!manifest || manifest.pstdio?.scope === "repo") return true;
  if (typeof entry !== "string" && entry.skipInstall) return false;
  return shouldInstallDependencies(targetPath);
};

const runDefaultExtensionInstall = async (
  deps: InstallDefaultExtensionsDeps,
  context: {
    config: DefaultExtensionsConfig;
    env: Record<string, string | undefined>;
  },
) => {
  const install = deps.installExtensionSource ?? installExtensionSource;
  const installed: InstalledExtensionSource[] = [];
  const reportFailure = (failure: {
    entry?: DefaultExtensionEntry;
    error: unknown;
    installName?: string;
    source: string;
  }) => {
    const installName =
      failure.installName ??
      (failure.entry && typeof failure.entry !== "string" ? failure.entry.installName : undefined) ??
      sourceFor(failure.entry ?? failure.source);
    deps.onInstallFailure?.({ error: failure.error, installName, source: failure.source });
  };

  await withResolvedDefaultEntries(
    {
      config: context.config,
      onEntryFailure: deps.onInstallFailure
        ? ({ entry, error, source }) => reportFailure({ entry, error, source })
        : undefined,
      prepareSharedCheckout: deps.prepareSharedCheckout,
      forceSourceDefaults: deps.forceSourceDefaults,
      releaseRef: deps.releaseRef,
      signal: deps.signal,
    },
    async (entries, prepareNamedSource) => {
      const pendingByName = new Map<string, Promise<InstalledExtensionSource | undefined>>();
      const pending: Promise<InstalledExtensionSource | undefined>[] = [];
      const active = new Set<Promise<void>>();
      for (const resolved of entries.filter((entry) => entry.scope === "user")) {
        // Leave capacity for the database and foreground UI while dependencies prepare.
        if (active.size >= 2) await Promise.race(active);
        const previous = pendingByName.get(resolved.installName);
        const request = (async () => {
          // Two entries for one target must not promote source trees over each other.
          if (previous) await previous;
          deps.signal?.throwIfAborted();
          try {
            return await traceSetupPhase("default_extensions.install", { extension: resolved.installName }, () =>
              install({
                ...toInstallInput(resolved.entry, deps.releaseRef),
                env: context.env,
                existsOk: true,
                prepareNamedSource,
                signal: deps.signal,
              }),
            );
          } catch (error) {
            if (!deps.onInstallFailure) throw error;
            reportFailure({ error, installName: resolved.installName, source: resolved.source });
            return undefined;
          }
        })();
        pendingByName.set(resolved.installName, request);
        pending.push(request);
        const complete = request
          .then(
            () => undefined,
            () => undefined,
          )
          .finally(() => active.delete(complete));
        active.add(complete);
      }
      // Every install must settle before the shared checkout can be removed.
      for (const result of await Promise.allSettled(pending)) {
        if (result.status === "rejected") throw result.reason;
        if (result.value) installed.push(result.value);
      }
    },
  );

  deps.signal?.throwIfAborted();
  return installed;
};

const prepareDefaultExtensions = (deps: InstallDefaultExtensionsDeps, mode: DefaultExtensionInstallMode) => {
  const env = { ...(deps.env ?? process.env) };
  return traceSetupPhase("default_extensions.request", {}, () =>
    enqueueDefaultExtensionInstall(async () => {
      return traceSetupPhase("default_extensions.active", {}, async () => {
        const catalog = deps.config ? undefined : await loadExtensionCatalog({ env });
        const config =
          deps.config ??
          (deps.installNames ? { defaultExtensions: deps.installNames } : await resolveDefaultExtensionsConfig(env));
        const entries = deps.config
          ? config.defaultExtensions
          : await Promise.all(
              config.defaultExtensions.map((entry) =>
                sourceModeDefaultEntry(entry, deps.forceSourceDefaults ?? true, catalog),
              ),
            );
        const extensionsRoot = join(resolvePstdioHome({ env }), "extensions");
        // Missing-only requests inspect disk after startup's queued source refresh finishes.
        // Project sync discovers installed sources and keeps their recorded Git origin.
        const defaultExtensions = entries
          .filter((entry) => needsDefaultExtensionInstall(entry, extensionsRoot, mode))
          .map((entry) =>
            mode === "ensure" && typeof entry !== "string"
              ? { ...entry, force: !isInstalledUserExtension(entry, extensionsRoot) }
              : entry,
          );
        const context = {
          config: { defaultExtensions },
          env,
        };
        return runDefaultExtensionInstall(deps, context);
      });
    }, deps.signal),
  );
};

export const installDefaultExtensions = (deps: InstallDefaultExtensionsDeps = {}) =>
  prepareDefaultExtensions(deps, "refresh");

// Project creation adopts the installed tools. Runtime startup owns forced source updates.
export const installMissingDefaultExtensions = (deps: InstallDefaultExtensionsDeps = {}) =>
  prepareDefaultExtensions(deps, "ensure");

export { registerInstalledExtensionSources } from "./register-installed-extension-sources";

type InstallRepoDefaultExtensionsInput = {
  defaultExtensions: DefaultExtensionEntry[];
  repoPath: string;
  env?: Record<string, string | undefined>;
  releaseRef?: string;
  prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
};

// A user install refuses repo-scoped sources, so an installed user copy proves the default is
// not repo-scoped. Skipping it keeps project folders from fetching sources they never install.
const isInstalledUserExtension = (entry: DefaultExtensionEntry, extensionsRoot: string) => {
  const installName = typeof entry === "string" ? entry : (entry.installName ?? basename(entry.source));
  if (!installName || installName === "." || installName === ".." || /[\\/:]/.test(installName)) return false;
  return existsSync(join(extensionsRoot, installName, "package.json"));
};

export const installRepoDefaultExtensions = async (input: InstallRepoDefaultExtensionsInput) => {
  const materialized: string[] = [];
  const skipped: string[] = [];

  const rollback = async () => {
    const results = await Promise.allSettled(
      materialized.map((name) =>
        rm(join(input.repoPath, ".pstdio", "extensions", name), { recursive: true, force: true }),
      ),
    );
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
  };

  const userExtensionsRoot = join(resolvePstdioHome({ env: input.env }), "extensions");
  const defaultExtensions = input.defaultExtensions.filter(
    (entry) => !isInstalledUserExtension(entry, userExtensionsRoot),
  );

  try {
    await withResolvedDefaultEntries(
      {
        config: { defaultExtensions },
        releaseRef: input.releaseRef,
        prepareSharedCheckout: input.prepareSharedCheckout,
        sourceMode: true,
      },
      async (entries, prepareNamedSource) => {
        for (const resolved of entries) {
          if (resolved.scope !== "repo") continue;

          const target = join(input.repoPath, ".pstdio", "extensions", resolved.installName);
          if (existsSync(target)) {
            skipped.push(resolved.installName);
            continue;
          }

          const installInput = toInstallInput(resolved.entry, input.releaseRef);
          await installExtensionSource({
            ...installInput,
            existsOk: false,
            force: false,
            prepareNamedSource,
            repoPath: input.repoPath,
          });
          materialized.push(resolved.installName);
        }
      },
    );
  } catch (error) {
    await rollback();
    throw error;
  }
  return { materialized, skipped, rollback };
};

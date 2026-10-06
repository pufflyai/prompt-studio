import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import { sourceFor, toInstallInput, withResolvedDefaultEntries } from "./default-extension-entries";
import { enqueueDefaultExtensionInstall } from "./default-extension-install-queue";
import {
  type DefaultExtensionEntry,
  type DefaultExtensionsConfig,
  resolveDefaultExtensionsConfig,
} from "./default-extensions-config";
import { type ExtensionCatalog, loadExtensionCatalog } from "./extension-catalog";
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

const runDefaultExtensionInstall = async (
  deps: InstallDefaultExtensionsDeps,
  context: {
    catalog?: ExtensionCatalog;
    config: DefaultExtensionsConfig;
    env: Record<string, string | undefined>;
    sourceMode: boolean;
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
      sourceMode: context.sourceMode,
      catalog: context.catalog,
    },
    async (entries, prepareNamedSource) => {
      for (const resolved of entries) {
        deps.signal?.throwIfAborted();
        if (resolved.scope !== "user") continue;
        try {
          installed.push(
            await install({
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
        }
      }
    },
  );

  deps.signal?.throwIfAborted();
  return installed;
};

export const installDefaultExtensions = (deps: InstallDefaultExtensionsDeps = {}) => {
  const env = { ...(deps.env ?? process.env) };
  return enqueueDefaultExtensionInstall(async () => {
    const catalog = deps.config ? undefined : await loadExtensionCatalog({ env });
    const context = {
      config:
        deps.config ??
        (deps.installNames ? { defaultExtensions: deps.installNames } : await resolveDefaultExtensionsConfig(env)),
      env,
      sourceMode: !deps.config,
      catalog,
    };
    return runDefaultExtensionInstall(deps, context);
  }, deps.signal);
};

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

import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { readPackageManifestMetadata } from "pstdio-extensions";
import { resolvePstdioHome } from "pstdio-paths";
import { traceSetupPhase } from "../../lib/setup-phase";
import type { ExtensionInstallations } from "../../services/extension-installations";
import {
  createDefaultCheckoutPool,
  sourceFor,
  sourceModeDefaultEntry,
  toInstallInput,
  withResolvedDefaultEntries,
} from "./default-extension-entries";
import { enqueueDefaultExtensionInstall, waitForDefaultExtensionInstall } from "./default-extension-install-queue";
import {
  type DefaultExtensionEntry,
  type DefaultExtensionsConfig,
  resolveDefaultExtensionsConfig,
} from "./default-extensions-config";
import { loadExtensionCatalog, packagedExtensionCatalog } from "./extension-catalog";
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
  extensionInstallations?: ExtensionInstallations;
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
    mode: DefaultExtensionInstallMode;
  },
) => {
  deps.signal?.throwIfAborted();
  const install = deps.installExtensionSource ?? installExtensionSource;
  const entries = context.config.defaultExtensions;
  const pool = createDefaultCheckoutPool(entries, deps.prepareSharedCheckout);
  const extensionsRoot = join(resolvePstdioHome({ env: context.env }), "extensions");
  const pending: Promise<InstalledExtensionSource | undefined>[] = [];
  const pendingByName = new Map<string, Promise<InstalledExtensionSource | undefined>>();
  const active = new Set<Promise<void>>();
  for (const entry of entries) {
    if (active.size >= 2) await Promise.race(active);
    const name = typeof entry === "string" ? entry : (entry.installName ?? basename(entry.source));
    const previous = pendingByName.get(name);
    const request = (async () => {
      if (previous) await previous;
      const perform = (signal?: AbortSignal) =>
        enqueueDefaultExtensionInstall(
          join(extensionsRoot, name),
          async () => {
            // A preceding install may have completed while this request waited for its target.
            if (!needsDefaultExtensionInstall(entry, extensionsRoot, context.mode)) return undefined;
            return withResolvedDefaultEntries(
              {
                config: { defaultExtensions: [entry] },
                prepareSharedCheckout: pool.prepare,
                releaseRef: deps.releaseRef,
                signal,
              },
              async (resolved, prepareNamedSource) => {
                const source = resolved[0];
                if (!source || source.scope !== "user") return undefined;
                return install({
                  ...toInstallInput(source.entry, deps.releaseRef),
                  env: context.env,
                  existsOk: true,
                  prepareNamedSource,
                  signal,
                });
              },
            );
          },
          signal,
        );
      const catalog = packagedExtensionCatalog.extensions.find((item) => item.installName === name);
      try {
        return await traceSetupPhase("default_extensions.install", { extension: name }, () =>
          deps.extensionInstallations
            ? deps.extensionInstallations.run(
                { installName: name, displayName: catalog?.displayName ?? name, extensionId: catalog?.extensionId },
                perform,
              )
            : perform(deps.signal),
        );
      } catch (error) {
        if (!deps.onInstallFailure) throw error;
        deps.onInstallFailure({ error, installName: name, source: sourceFor(entry) });
        return undefined;
      }
    })();
    pendingByName.set(name, request);
    pending.push(request);
    const complete = request
      .then(
        () => undefined,
        () => undefined,
      )
      .finally(() => active.delete(complete));
    active.add(complete);
  }
  const results = await Promise.allSettled(pending);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  deps.signal?.throwIfAborted();
  return results.flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []));
};

const prepareDefaultExtensions = (deps: InstallDefaultExtensionsDeps, mode: DefaultExtensionInstallMode) => {
  const env = { ...(deps.env ?? process.env) };
  return traceSetupPhase("default_extensions.request", {}, () =>
    traceSetupPhase("default_extensions.active", {}, async () => {
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
      // Inspect again under the target lock before replacing source files.
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
        mode,
      };
      return runDefaultExtensionInstall(deps, context);
    }),
  );
};

export const installDefaultExtensions = (deps: InstallDefaultExtensionsDeps = {}) =>
  waitForDefaultExtensionInstall(prepareDefaultExtensions(deps, "refresh"), deps.signal);

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
  signal?: AbortSignal;
  extensionInstallations?: ExtensionInstallations;
  projectId?: string;
  afterInstall?: () => Promise<void>;
};

// A user install refuses repo-scoped sources, so an installed user copy proves the default is
// not repo-scoped. Skipping it keeps project folders from fetching sources they never install.
const isInstalledUserExtension = (entry: DefaultExtensionEntry, extensionsRoot: string) => {
  const installName = typeof entry === "string" ? entry : (entry.installName ?? basename(entry.source));
  if (!installName || installName === "." || installName === ".." || /[\\/:]/.test(installName)) return false;
  return existsSync(join(extensionsRoot, installName, "package.json"));
};

const materializeRepoDefaultExtensions = async (input: InstallRepoDefaultExtensionsInput) => {
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
        signal: input.signal,
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
            signal: input.signal,
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

export const installRepoDefaultExtensions = async (input: InstallRepoDefaultExtensionsInput) => {
  if (!input.extensionInstallations) return materializeRepoDefaultExtensions(input);
  const jobs = input.extensionInstallations;
  const extensionsRoot = join(resolvePstdioHome({ env: input.env }), "extensions");
  const defaultExtensions = input.defaultExtensions.filter((entry) => !isInstalledUserExtension(entry, extensionsRoot));
  const pool = createDefaultCheckoutPool(defaultExtensions, input.prepareSharedCheckout);
  return withResolvedDefaultEntries(
    {
      config: { defaultExtensions },
      sourceMode: true,
      releaseRef: input.releaseRef,
      prepareSharedCheckout: pool.prepare,
    },
    async (entries) => {
      const identities = entries
        .filter((entry) => entry.scope === "repo")
        .map(({ installName }) => ({
          projectId: input.projectId,
          installName,
          displayName: installName,
        }));
      return jobs.runGroup(
        identities,
        (signal) => materializeRepoDefaultExtensions({ ...input, prepareSharedCheckout: pool.prepare, signal }),
        identities.map(({ installName }) => join(input.repoPath, ".pstdio", "extensions", installName)),
        input.afterInstall,
      );
    },
  );
};

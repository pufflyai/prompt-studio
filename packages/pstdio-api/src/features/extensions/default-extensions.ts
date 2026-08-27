import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { readPackageManifestMetadata } from "pstdio-extensions";
import { enqueueDefaultExtensionInstall } from "./default-extension-install-queue";
import {
  type DefaultExtensionEntry,
  type DefaultExtensionsConfig,
  resolveDefaultExtensionsConfig,
} from "./default-extensions-config";
import { marketplaceExtensionRepositoryPath } from "./extension-marketplace";
import {
  createSharedNamedSourceCheckout,
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  installExtensionSource,
  isLocalExtensionSource,
  toExtensionEnableInput,
} from "./install-extension-source";

export {
  type DefaultExtensionEntry,
  type DefaultExtensionsConfig,
  defaultExtensions,
  resolveDefaultExtensionsConfig,
} from "./default-extensions-config";
export { syncInstalledExtensionsForProject, syncInstalledExtensionsForProjects } from "./installed-extension-sync";

const entryRef = (entry: DefaultExtensionEntry) => (typeof entry === "string" ? undefined : entry.ref);

const toInstallInput = (entry: DefaultExtensionEntry, releaseRef?: string): InstallExtensionSourceInput => {
  const source = sourceFor(entry);
  const local = isLocalExtensionSource(source);
  const ref = local ? entryRef(entry) : (entryRef(entry) ?? releaseRef);
  if (typeof entry === "string") return { allowUnsupportedApiVersion: true, source: entry, ref };
  return {
    source: entry.source,
    installName: entry.installName,
    ref,
    skipInstall: entry.skipInstall,
    force: entry.force,
    ...(!local ? { allowUnsupportedApiVersion: true } : {}),
  };
};

const sourceFor = (entry: DefaultExtensionEntry) => (typeof entry === "string" ? entry : entry.source);

const sourceModeDefaultEntry = async (entry: DefaultExtensionEntry, force: boolean): Promise<DefaultExtensionEntry> => {
  if (typeof entry !== "string") return entry;

  const localSource = join(import.meta.dirname, "../../../../../", marketplaceExtensionRepositoryPath(entry));
  if (existsSync(localSource)) return { source: localSource, installName: entry, force, skipInstall: true };
  return entry;
};

type InstallDefaultExtensionsDeps = {
  config?: DefaultExtensionsConfig;
  env?: Record<string, string | undefined>;
  forceSourceDefaults?: boolean;
  installExtensionSource?: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  onInstallFailure?: (failure: { error: unknown; installName: string; source: string }) => void;
  prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
  releaseRef?: string;
  signal?: AbortSignal;
};

type LoadScope = "user" | "repo";

const repoDefaultInstallName = (entry: DefaultExtensionEntry, sourcePath: string) => {
  if (typeof entry !== "string" && entry.installName) return entry.installName;
  return basename(sourcePath);
};

type ResolvedDefaultEntry = {
  entry: DefaultExtensionEntry;
  installName: string;
  scope: LoadScope;
  source: string;
};

const resolveLocalSource = (source: string) => {
  if (source.startsWith("~/")) return join(homedir(), source.slice(2));
  if (isAbsolute(source)) return source;
  return resolve(source);
};

const readDefaultScope = (sourcePath: string) => {
  if (!existsSync(sourcePath) || !statSync(sourcePath).isDirectory()) {
    throw new Error(`Extension source folder not found: ${sourcePath}`);
  }

  const { manifest, diagnostics } = readPackageManifestMetadata(sourcePath);
  if (!manifest) {
    const first = diagnostics[0];
    throw new Error(first?.message ?? `Default extension validation failed: ${sourcePath}`);
  }
  return manifest.pstdio?.scope ?? "user";
};

type SharedCheckout = Awaited<ReturnType<typeof createSharedNamedSourceCheckout>>;

const prepareDefaultCheckouts = async (
  entries: DefaultExtensionEntry[],
  input: {
    prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
    releaseRef?: string;
    signal?: AbortSignal;
  },
) => {
  const namedByRef = new Map<string | undefined, string[]>();
  for (const entry of entries) {
    const source = sourceFor(entry);
    if (isLocalExtensionSource(source)) continue;
    const ref = entryRef(entry) ?? input.releaseRef;
    namedByRef.set(ref, [...(namedByRef.get(ref) ?? []), source]);
  }

  const prepareShared = input.prepareSharedCheckout ?? createSharedNamedSourceCheckout;
  const sharedByRef = new Map<string | undefined, SharedCheckout>();
  for (const [ref, names] of namedByRef) {
    input.signal?.throwIfAborted();
    sharedByRef.set(
      ref,
      await prepareShared(names, {
        ...(ref ? { ref } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      }),
    );
  }
  return sharedByRef;
};

const createPreparedSourceResolver = (sharedByRef: Map<string | undefined, SharedCheckout>, releaseRef?: string) => {
  const prepareNamedSource: SharedCheckout["prepareNamedSource"] = async (name, _tempDir, ref, signal) => {
    signal?.throwIfAborted();
    const shared = sharedByRef.get(ref ?? releaseRef);
    if (!shared) throw new Error(`No prepared checkout for extension: ${name}`);
    return shared.prepareNamedSource(name, "", ref, signal);
  };
  return prepareNamedSource;
};

const withResolvedDefaultEntries = async <T>(
  input: {
    config: DefaultExtensionsConfig;
    forceSourceDefaults?: boolean;
    onEntryFailure?: (failure: { entry: DefaultExtensionEntry; error: unknown; source: string }) => void;
    prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
    releaseRef?: string;
    signal?: AbortSignal;
    sourceMode?: boolean;
  },
  fn: (
    entries: ResolvedDefaultEntry[],
    prepareNamedSource: Awaited<ReturnType<typeof createSharedNamedSourceCheckout>>["prepareNamedSource"] | undefined,
  ) => Promise<T>,
) => {
  const entries = input.sourceMode
    ? await Promise.all(
        input.config.defaultExtensions.map((entry) => sourceModeDefaultEntry(entry, input.forceSourceDefaults ?? true)),
      )
    : input.config.defaultExtensions;
  const sharedByRef = await prepareDefaultCheckouts(entries, input);
  const prepareNamedSource = createPreparedSourceResolver(sharedByRef, input.releaseRef);

  try {
    const resolved: ResolvedDefaultEntry[] = [];
    for (const entry of entries) {
      input.signal?.throwIfAborted();
      const source = sourceFor(entry);
      try {
        const sourcePath = isLocalExtensionSource(source)
          ? resolveLocalSource(source)
          : (await prepareNamedSource(source, "", entryRef(entry) ?? input.releaseRef, input.signal)).path;
        if (!sourcePath) continue;

        resolved.push({
          entry,
          installName: repoDefaultInstallName(entry, sourcePath),
          scope: readDefaultScope(sourcePath),
          source,
        });
      } catch (error) {
        if (!input.onEntryFailure) throw error;
        input.onEntryFailure({ entry, error, source });
      }
    }

    return await fn(resolved, sharedByRef.size > 0 ? prepareNamedSource : undefined);
  } finally {
    for (const shared of sharedByRef.values()) shared.cleanup();
  }
};

const runDefaultExtensionInstall = async (
  deps: InstallDefaultExtensionsDeps,
  context: { config: DefaultExtensionsConfig; env: Record<string, string | undefined>; sourceMode: boolean },
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
  const context = {
    config: deps.config ?? resolveDefaultExtensionsConfig(env),
    env,
    sourceMode: !deps.config,
  };
  return enqueueDefaultExtensionInstall(() => runDefaultExtensionInstall(deps, context), deps.signal);
};

export const registerInstalledExtensionSources = async (
  extensionService: {
    registerInstalledSource: (input: {
      displayName: string;
      extensionId: string;
      installName: string;
      manifest: Record<string, unknown>;
      name: string;
      sourceHash: string;
      sourceKind: "git" | "local_path";
      sourcePath: string;
      sourceRef: string | null;
      version: string | null;
    }) => Promise<unknown>;
  },
  installed: InstalledExtensionSource[],
) => {
  for (const extension of installed) {
    await extensionService.registerInstalledSource({
      installName: extension.installName,
      ...toExtensionEnableInput(extension),
    });
  }
};

type InstallRepoDefaultExtensionsInput = {
  defaultExtensions: DefaultExtensionEntry[];
  repoPath: string;
  prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
};

export const installRepoDefaultExtensions = async (input: InstallRepoDefaultExtensionsInput) => {
  const materialized: string[] = [];
  const skipped: string[] = [];

  await withResolvedDefaultEntries(
    {
      config: { defaultExtensions: input.defaultExtensions },
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

        const installInput = toInstallInput(resolved.entry);
        await installExtensionSource({
          ...installInput,
          existsOk: true,
          force: false,
          prepareNamedSource,
          repoPath: input.repoPath,
        });
        materialized.push(resolved.installName);
      }
    },
  );

  return { materialized, skipped };
};

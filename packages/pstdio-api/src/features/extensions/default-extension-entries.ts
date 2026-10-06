import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { readPackageManifestMetadata } from "pstdio-extensions";
import type { DefaultExtensionEntry, DefaultExtensionsConfig } from "./default-extensions-config";
import { type ExtensionCatalog, findExtensionCatalogEntry } from "./extension-catalog";
import {
  createSharedNamedSourceCheckout,
  type InstallExtensionSourceInput,
  isLocalExtensionSource,
} from "./install-extension-source";

const entryRef = (entry: DefaultExtensionEntry) => (typeof entry === "string" ? undefined : entry.ref);

export const toInstallInput = (entry: DefaultExtensionEntry, releaseRef?: string): InstallExtensionSourceInput => {
  const source = sourceFor(entry);
  const local = isLocalExtensionSource(source);
  const ref = entryRef(entry);
  if (typeof entry === "string") {
    return { allowUnsupportedApiVersion: true, source: entry, ref, hostReleaseRef: releaseRef };
  }
  return {
    source: entry.source,
    installName: entry.installName,
    ref,
    hostReleaseRef: local ? undefined : releaseRef,
    skipInstall: entry.skipInstall,
    force: entry.force,
    ...(!local ? { allowUnsupportedApiVersion: true } : {}),
  };
};

export const sourceFor = (entry: DefaultExtensionEntry) => (typeof entry === "string" ? entry : entry.source);

const sourceModeDefaultEntry = async (
  entry: DefaultExtensionEntry,
  force: boolean,
  catalog?: ExtensionCatalog,
): Promise<DefaultExtensionEntry> => {
  if (typeof entry !== "string") return entry;

  const catalogEntry =
    catalog?.extensions.find((candidate) => candidate.installName === entry) ??
    (await findExtensionCatalogEntry(entry));
  if (!catalogEntry) throw new Error(`No catalog entry for extension: ${entry}`);
  const localSource = join(import.meta.dirname, "../../../../../", catalogEntry.origin.path);
  if (existsSync(localSource)) return { source: localSource, installName: entry, force, skipInstall: true };
  return entry;
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
    const ref = entryRef(entry);
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
        hostReleaseRef: input.releaseRef,
        ...(input.signal ? { signal: input.signal } : {}),
      }),
    );
  }
  return sharedByRef;
};

const createPreparedSourceResolver = (sharedByRef: Map<string | undefined, SharedCheckout>) => {
  const prepareNamedSource: SharedCheckout["prepareNamedSource"] = async (name, _tempDir, ref, signal) => {
    signal?.throwIfAborted();
    const shared = sharedByRef.get(ref);
    if (!shared) throw new Error(`No prepared checkout for extension: ${name}`);
    return shared.prepareNamedSource(name, "", ref, signal);
  };
  return prepareNamedSource;
};

export const withResolvedDefaultEntries = async <T>(
  input: {
    config: DefaultExtensionsConfig;
    forceSourceDefaults?: boolean;
    onEntryFailure?: (failure: { entry: DefaultExtensionEntry; error: unknown; source: string }) => void;
    prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
    releaseRef?: string;
    signal?: AbortSignal;
    sourceMode?: boolean;
    catalog?: ExtensionCatalog;
  },
  fn: (
    entries: ResolvedDefaultEntry[],
    prepareNamedSource: Awaited<ReturnType<typeof createSharedNamedSourceCheckout>>["prepareNamedSource"] | undefined,
  ) => Promise<T>,
) => {
  const entries = input.sourceMode
    ? await Promise.all(
        input.config.defaultExtensions.map((entry) =>
          sourceModeDefaultEntry(entry, input.forceSourceDefaults ?? true, input.catalog),
        ),
      )
    : input.config.defaultExtensions;
  const sharedByRef = await prepareDefaultCheckouts(entries, input);
  const prepareNamedSource = createPreparedSourceResolver(sharedByRef);

  try {
    const resolved: ResolvedDefaultEntry[] = [];
    for (const entry of entries) {
      input.signal?.throwIfAborted();
      const source = sourceFor(entry);
      try {
        const sourcePath = isLocalExtensionSource(source)
          ? resolveLocalSource(source)
          : (await prepareNamedSource(source, "", entryRef(entry), input.signal)).path;
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

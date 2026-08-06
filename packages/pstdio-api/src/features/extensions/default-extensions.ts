import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { readPackageManifest } from "pstdio-extensions";
import { normalizeEmbeddedFileName } from "pstdio-paths";
import {
  createSharedNamedSourceCheckout,
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  installExtensionSource,
  isLocalExtensionSource,
} from "./install-extension-source";

export { syncInstalledExtensionsForProject, syncInstalledExtensionsForProjects } from "./installed-extension-sync";

export type DefaultExtensionEntry =
  | string
  | {
      force?: boolean;
      installName?: string;
      skipInstall?: boolean;
      source: string;
    };

export type DefaultExtensionsConfig = {
  defaultExtensions: DefaultExtensionEntry[];
};

export const defaultExtensions: DefaultExtensionsConfig = {
  defaultExtensions: [
    "harness-claude-code",
    "harness-codex",
    "harness-open-code",
    "pstdio-base-themes",
    "pstdio-planner",
    "pstdio-reports",
    "pstdio-skills",
  ],
};

const toConfig = (parsed: unknown): DefaultExtensionsConfig => {
  if (Array.isArray(parsed)) return { defaultExtensions: parsed as DefaultExtensionEntry[] };
  if (parsed && typeof parsed === "object" && "defaultExtensions" in parsed) {
    return {
      defaultExtensions: (parsed as { defaultExtensions: DefaultExtensionEntry[] }).defaultExtensions,
    };
  }
  throw new Error("PSTDIO_DEFAULT_EXTENSIONS must be a JSON array or object with defaultExtensions");
};

export const resolveDefaultExtensionsConfig = (env: Record<string, string | undefined> = process.env) => {
  const raw = env.PSTDIO_DEFAULT_EXTENSIONS;
  if (!raw) return defaultExtensions;

  try {
    return toConfig(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid PSTDIO_DEFAULT_EXTENSIONS JSON: ${error.message}`);
    }
    throw error;
  }
};

const toInstallInput = (entry: DefaultExtensionEntry): InstallExtensionSourceInput => {
  if (typeof entry === "string") return { source: entry };
  return {
    source: entry.source,
    installName: entry.installName,
    skipInstall: entry.skipInstall,
    force: entry.force,
  };
};

const sourceFor = (entry: DefaultExtensionEntry) => (typeof entry === "string" ? entry : entry.source);

type EmbeddedFile = Blob & { name: string };

const EMBEDDED_EXTENSIONS_PREFIX = "../../../extensions/";

const getEmbeddedFiles = () => {
  try {
    const files = (Bun as Record<string, unknown>).embeddedFiles;
    if (Array.isArray(files)) return files as EmbeddedFile[];
  } catch {
    // Bun.embeddedFiles is only available in compiled runtimes and tests that fake it.
  }
  return [];
};

const normalizeEmbeddedRelativePath = (relativePath: string) =>
  relativePath.endsWith(".") ? relativePath.slice(0, -1) : relativePath;

const embeddedExtensionFiles = (name: string) => {
  const prefix = `${EMBEDDED_EXTENSIONS_PREFIX}${name}/`;
  return {
    files: getEmbeddedFiles().filter((file) => normalizeEmbeddedFileName(file.name).startsWith(prefix)),
    prefix,
  };
};

const extractEmbeddedDefaultExtension = async (name: string) => {
  const { files, prefix } = embeddedExtensionFiles(name);
  if (files.length === 0) return null;

  const targetDir = join(tmpdir(), "pstdio-default-extensions", name);
  rmSync(targetDir, { recursive: true, force: true });

  for (const file of files) {
    const relativePath = normalizeEmbeddedRelativePath(normalizeEmbeddedFileName(file.name).slice(prefix.length));
    const targetPath = join(targetDir, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, new Uint8Array(await file.arrayBuffer()));
  }

  return targetDir;
};

const sourceModeDefaultEntry = async (entry: DefaultExtensionEntry, force: boolean): Promise<DefaultExtensionEntry> => {
  if (typeof entry !== "string") return entry;

  const localSource = join(import.meta.dirname, "../../../../../extensions", entry);
  if (existsSync(localSource)) return { source: localSource, installName: entry, force };

  const bundledSource = await extractEmbeddedDefaultExtension(entry);
  if (!bundledSource) return entry;

  return { source: bundledSource, installName: entry, force };
};

type InstallDefaultExtensionsDeps = {
  config?: DefaultExtensionsConfig;
  env?: Record<string, string | undefined>;
  forceSourceDefaults?: boolean;
  installExtensionSource?: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  onInstallFailure?: (failure: { error: unknown; installName: string; source: string }) => void;
  prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
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

  const { manifest, diagnostics } = readPackageManifest(sourcePath);
  if (!manifest) {
    const first = diagnostics[0];
    throw new Error(first?.message ?? `Default extension validation failed: ${sourcePath}`);
  }
  return manifest.pstdio?.scope ?? "user";
};

const withResolvedDefaultEntries = async <T>(
  input: {
    config: DefaultExtensionsConfig;
    forceSourceDefaults?: boolean;
    onEntryFailure?: (failure: { entry: DefaultExtensionEntry; error: unknown; source: string }) => void;
    prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
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
  const namedNames = entries.map(sourceFor).filter((source) => !isLocalExtensionSource(source));
  const prepareShared = input.prepareSharedCheckout ?? createSharedNamedSourceCheckout;
  const shared = namedNames.length > 0 ? await prepareShared(namedNames) : null;

  try {
    const resolved: ResolvedDefaultEntry[] = [];
    for (const entry of entries) {
      const source = sourceFor(entry);
      try {
        const sourcePath = isLocalExtensionSource(source)
          ? resolveLocalSource(source)
          : (await shared?.prepareNamedSource(source, ""))?.path;
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

    return await fn(resolved, shared?.prepareNamedSource);
  } finally {
    shared?.cleanup();
  }
};

export const installDefaultExtensions = async (deps: InstallDefaultExtensionsDeps = {}) => {
  const config = deps.config ?? resolveDefaultExtensionsConfig(deps.env);
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
      config,
      onEntryFailure: deps.onInstallFailure
        ? ({ entry, error, source }) => reportFailure({ entry, error, source })
        : undefined,
      prepareSharedCheckout: deps.prepareSharedCheckout,
      forceSourceDefaults: deps.forceSourceDefaults,
      sourceMode: !deps.config,
    },
    async (entries, prepareNamedSource) => {
      for (const resolved of entries) {
        if (resolved.scope !== "user") continue;
        try {
          installed.push(
            await install({
              ...toInstallInput(resolved.entry),
              existsOk: true,
              prepareNamedSource,
            }),
          );
        } catch (error) {
          if (!deps.onInstallFailure) throw error;
          reportFailure({ error, installName: resolved.installName, source: resolved.source });
        }
      }
    },
  );

  return installed;
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

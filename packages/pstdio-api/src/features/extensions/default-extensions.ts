import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { EnableInstalledSourceInput } from "../../services/extension-service";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import {
  createSharedNamedSourceCheckout,
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  installExtensionSource,
  isLocalExtensionSource,
  resolvePstdioHome,
} from "./install-extension-source";

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
  defaultExtensions: ["pstdio-core-skills", "pstdio-core-templates"],
};

const toConfig = (parsed: unknown): DefaultExtensionsConfig => {
  if (Array.isArray(parsed)) return { defaultExtensions: parsed as DefaultExtensionEntry[] };
  if (parsed && typeof parsed === "object" && "defaultExtensions" in parsed) {
    return parsed as DefaultExtensionsConfig;
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

type InstallDefaultExtensionsDeps = {
  config?: DefaultExtensionsConfig;
  installExtensionSource?: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
};

export const installDefaultExtensions = async (deps: InstallDefaultExtensionsDeps = {}) => {
  const config = deps.config ?? resolveDefaultExtensionsConfig();
  const install = deps.installExtensionSource ?? installExtensionSource;
  const prepareShared = deps.prepareSharedCheckout ?? createSharedNamedSourceCheckout;

  const namedNames = config.defaultExtensions.map(sourceFor).filter((source) => !isLocalExtensionSource(source));
  const shared = namedNames.length > 0 ? await prepareShared(namedNames) : null;
  const installed: InstalledExtensionSource[] = [];

  try {
    for (const entry of config.defaultExtensions) {
      installed.push(
        await install({
          ...toInstallInput(entry),
          existsOk: true,
          prepareNamedSource: shared?.prepareNamedSource,
        }),
      );
    }
  } finally {
    shared?.cleanup();
  }

  return installed;
};

type EnableInstalledExtensionsDeps = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  extensionService: {
    enableInstalledSourceForProject: (input: EnableInstalledSourceInput) => Promise<unknown>;
  };
  extensionsRoot?: string;
  homedir?: () => string;
  loadExtension?: typeof loadExtensionSource;
  hashExtension?: typeof hashExtensionSource;
  projectId: string;
};

export const enableInstalledExtensionsForProject = async (deps: EnableInstalledExtensionsDeps) => {
  const root = deps.extensionsRoot ?? join(resolvePstdioHome({ env: deps.env, homedir: deps.homedir }), "extensions");
  if (!existsSync(root)) return [];

  const load = deps.loadExtension ?? loadExtensionSource;
  const hash = deps.hashExtension ?? hashExtensionSource;
  const enabled: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const sourcePath = join(root, entry.name);

    let loaded: Awaited<ReturnType<typeof loadExtensionSource>>;
    try {
      loaded = await load(sourcePath);
    } catch {
      // User-edited installed sources can become invalid; project creation should still enable healthy extensions.
      continue;
    }

    await deps.extensionService.enableInstalledSourceForProject({
      projectId: deps.projectId,
      installName: entry.name,
      displayName: loaded.metadata.displayName,
      extensionId: loaded.metadata.id,
      manifest: loaded.manifest,
      name: loaded.metadata.name,
      sourceHash: hash(sourcePath),
      sourcePath,
      version: loaded.metadata.version,
    });

    enabled.push(entry.name);
  }

  return enabled;
};

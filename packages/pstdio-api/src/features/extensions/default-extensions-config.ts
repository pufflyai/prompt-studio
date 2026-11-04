import { basename } from "node:path";
import { requiredDefaultInstallNames } from "./always-on-extensions";
import { readDefaultExtensionRemovals } from "./default-extension-removals";
import { loadExtensionCatalog } from "./extension-catalog";

export type DefaultExtensionEntry =
  | string
  | {
      force?: boolean;
      installName?: string;
      ref?: string;
      skipInstall?: boolean;
      source: string;
    };

export type DefaultExtensionsConfig = {
  defaultExtensions: DefaultExtensionEntry[];
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

export const resolveDefaultExtensionsConfig = async (env: Record<string, string | undefined> = process.env) => {
  const removed = await readDefaultExtensionRemovals(env);
  const raw = env.PSTDIO_DEFAULT_EXTENSIONS;
  if (!raw) {
    const catalog = await loadExtensionCatalog({ env });
    return {
      defaultExtensions: catalog.extensions
        .filter((extension) => extension.alwaysEnabled || (extension.default && !removed.has(extension.installName)))
        .map((extension) => extension.installName),
    };
  }

  try {
    const required = removed.size ? await requiredDefaultInstallNames(env) : new Set<string>();
    const keep = (entry: DefaultExtensionEntry) => {
      const name = typeof entry === "string" ? basename(entry) : (entry.installName ?? basename(entry.source));
      return required.has(name) || !removed.has(name);
    };
    return { defaultExtensions: toConfig(JSON.parse(raw) as unknown).defaultExtensions.filter(keep) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid PSTDIO_DEFAULT_EXTENSIONS JSON: ${error.message}`);
    }
    throw error;
  }
};

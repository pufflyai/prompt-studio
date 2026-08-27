import { extensionMarketplace } from "./extension-marketplace";

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

export const defaultExtensions: DefaultExtensionsConfig = {
  defaultExtensions: extensionMarketplace.map((extension) => extension.installName),
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

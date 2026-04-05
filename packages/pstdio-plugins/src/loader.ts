import { derivePluginIdentity, discoverPluginFiles } from "./discovery";
import type { LoadedPlugin, PluginDefinition } from "./types";

const isValidPluginShape = (value: unknown): value is PluginDefinition =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const loadPlugins = async (pluginsDir: string) => {
  const files = discoverPluginFiles(pluginsDir);
  if (files.length === 0) return [];

  const plugins: LoadedPlugin[] = [];
  const identitySources = new Map<string, string>();

  for (const filePath of files) {
    let mod: Record<string, unknown>;
    try {
      mod = await import(filePath);
    } catch {
      continue;
    }

    if (!("default" in mod) || mod.default === undefined) continue;

    const definition = mod.default;

    if (!isValidPluginShape(definition)) {
      throw new Error(`Plugin file ${filePath}: default export is not a valid plugin definition`);
    }

    const identity = derivePluginIdentity(pluginsDir, filePath);
    const existing = identitySources.get(identity);
    if (existing) {
      throw new Error(`Duplicate plugin identity "${identity}" from files: ${existing}, ${filePath}`);
    }

    identitySources.set(identity, filePath);
    plugins.push({ identity, filePath, definition });
  }

  return plugins;
};

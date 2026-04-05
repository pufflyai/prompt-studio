import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_EXTENSIONS = new Set([".ts", ".js", ".mts", ".mjs", ".cts", ".cjs"]);
const EXCLUDE_PATTERN = /\.(d\.ts|test\.\w+|spec\.\w+)$/;

const hasSourceExtension = (name: string) => {
  for (const ext of SOURCE_EXTENSIONS) {
    if (name.endsWith(ext)) return true;
  }
  return false;
};

export const discoverPluginFiles = (pluginsDir: string) => {
  if (!existsSync(pluginsDir)) return [];

  const entries = readdirSync(pluginsDir, { recursive: true, encoding: "utf-8" });

  return entries
    .filter((entry) => hasSourceExtension(entry) && !EXCLUDE_PATTERN.test(entry))
    .map((entry) => join(pluginsDir, entry))
    .sort();
};

export const derivePluginIdentity = (pluginsDir: string, filePath: string) => {
  const rel = relative(pluginsDir, filePath);
  const normalized = rel.replaceAll("\\", "/");
  return normalized.replace(/\.[^.]+$/, "");
};

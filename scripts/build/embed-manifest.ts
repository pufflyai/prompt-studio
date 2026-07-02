import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface EmbedConfig {
  globs: string[];
  files: string[];
  noStraysIn: string[];
  platformBinaries: { pkg: string; bin: string }[];
  buildTargets: { target: string; pkg: string; bin: string }[];
}

export const loadEmbedConfig = (path = "scripts/embed.json"): EmbedConfig => {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as EmbedConfig & { $comment?: string };
  if (!Array.isArray(parsed.files)) throw new Error(`${path}: missing 'files' array`);
  if (!Array.isArray(parsed.globs)) throw new Error(`${path}: missing 'globs' array`);
  return parsed;
};

const collectTree = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    if (isDevOnlyDirectory(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...collectTree(full));
    else if (!isDevOnlyFile(entry)) out.push(full);
  }
  return out;
};

const devOnlyDirectories = new Set(["node_modules", "__tests__", "__fixtures__", "mocks"]);
const devOnlySourcePattern = /\.(?:spec|test|fixture)\.[cm]?[jt]sx?$/;
const testHelperPattern = /\.test-helpers\.[cm]?[jt]sx?$/;

const isDevOnlyDirectory = (entry: string) => devOnlyDirectories.has(entry);

const isDevOnlyFile = (entry: string) =>
  devOnlySourcePattern.test(entry) || testHelperPattern.test(entry) || entry.endsWith(".d.ts");

const expandGlob = (pattern: string) => {
  if (!pattern.endsWith("/**")) {
    throw new Error(`Unsupported glob pattern: ${pattern} (only '<dir>/**' is allowed)`);
  }
  const dir = pattern.slice(0, -3);
  return collectTree(dir);
};

export const resolveEmbedFiles = (config: EmbedConfig) => {
  const missing: string[] = [];
  for (const file of config.files) {
    if (!existsSync(file)) missing.push(file);
  }
  if (missing.length > 0) {
    throw new Error(`embed manifest references missing files:\n  ${missing.join("\n  ")}`);
  }

  const strays: string[] = [];
  const allowedSet = new Set(config.files.map((f) => f.replaceAll("\\", "/")));
  for (const root of config.noStraysIn) {
    for (const file of collectTree(root)) {
      const normalized = file.replaceAll("\\", "/");
      if (!allowedSet.has(normalized)) strays.push(normalized);
    }
  }
  if (strays.length > 0) {
    throw new Error(
      `Found files under noStraysIn roots that are not listed in embed.json:\n  ${strays.join("\n  ")}\n\nAdd them to scripts/embed.json or remove them.`,
    );
  }

  const fromGlobs = config.globs.flatMap(expandGlob).map((f) => f.replaceAll("\\", "/"));
  return [...config.files.map((f) => f.replaceAll("\\", "/")), ...fromGlobs].sort();
};

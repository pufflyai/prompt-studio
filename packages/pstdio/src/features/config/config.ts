import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const CONFIG_DIR = ".pstdio";
const CONFIG_FILE = "config.json";

// config.json carries host-owned workspace identity and must stay out of git.
const GITIGNORE_FILE = ".gitignore";
const DEFAULT_GITIGNORE = "config.json\n";

export const findProjectRoot = (startDir: string) => {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, CONFIG_DIR, CONFIG_FILE))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

type PstdioConfig = {
  project_id: string;
  // Set when a worktree-backed workspace copies its config, so CLI/extension
  // commands run from inside the worktree resolve their workspace without a flag.
  workspace_id?: string;
};

export const readConfig = (root: string) => {
  const configPath = join(root, CONFIG_DIR, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return null;
  }

  return JSON.parse(readFileSync(configPath, "utf8")) as PstdioConfig;
};

export const ensureConfigGitignore = (configDir: string) => {
  const gitignorePath = join(configDir, GITIGNORE_FILE);
  if (!existsSync(gitignorePath)) writeFileSync(gitignorePath, DEFAULT_GITIGNORE);
};

export const writeConfig = (root: string, config: PstdioConfig) => {
  const configDir = join(root, CONFIG_DIR);
  mkdirSync(configDir, { recursive: true });

  const configPath = join(configDir, CONFIG_FILE);
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  ensureConfigGitignore(configDir);
};

export const removeConfig = (root: string) => {
  const configPath = join(root, CONFIG_DIR, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return false;
  }

  rmSync(configPath);
  return true;
};

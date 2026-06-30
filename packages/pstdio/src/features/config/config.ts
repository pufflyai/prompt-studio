import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";

const CONFIG_DIR = ".pstdio";
const CONFIG_FILE = "config.json";

// config.json carries a per-workspace id and tickets are a local cache, so neither should
// be committed; drop a .pstdio/.gitignore by default so every project ignores them.
const GITIGNORE_FILE = ".gitignore";
const DEFAULT_GITIGNORE = "/tickets\nconfig.json\n";

type PstdioConfig = {
  project_id: string;
  // Set when a worktree-backed workspace copies its config, so CLI/extension
  // commands run from inside the worktree resolve their workspace without a flag.
  workspace_id?: string;
};

export const findGitRoot = (startDir: string) => {
  let current = startDir;

  while (true) {
    const gitPath = join(current, ".git");

    if (existsSync(gitPath)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
};

// A git worktree's `.git` is a file ("gitdir: <repo>/.git/worktrees/<name>"), not a
// directory, so its working-tree root is never the repo that owns it. Resolve such a
// root back to the owning repo so a worktree-backed workspace maps to its registered
// repo. A normal checkout (or any root without a worktree pointer) resolves to itself.
export const resolveOwningRepoRoot = (root: string) => {
  const gitPath = join(root, ".git");
  if (!existsSync(gitPath) || statSync(gitPath).isDirectory()) return root;

  const pointer = readFileSync(gitPath, "utf8")
    .trim()
    .replace(/^gitdir:\s*/, "");
  const marker = `${sep}.git${sep}worktrees${sep}`;
  const index = pointer.indexOf(marker);
  return index === -1 ? root : pointer.slice(0, index);
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

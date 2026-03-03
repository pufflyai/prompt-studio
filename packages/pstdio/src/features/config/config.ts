import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const CONFIG_DIR = ".pstdio";
const CONFIG_FILE = "config.json";

type PstdioConfig = {
  project_id: string;
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

export const readConfig = (root: string) => {
  const configPath = join(root, CONFIG_DIR, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return null;
  }

  return JSON.parse(readFileSync(configPath, "utf8")) as PstdioConfig;
};

export const writeConfig = (root: string, config: PstdioConfig) => {
  const configDir = join(root, CONFIG_DIR);
  mkdirSync(configDir, { recursive: true });

  const configPath = join(configDir, CONFIG_FILE);
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
};

export const removeConfig = (root: string) => {
  const configPath = join(root, CONFIG_DIR, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return false;
  }

  rmSync(configPath);
  return true;
};

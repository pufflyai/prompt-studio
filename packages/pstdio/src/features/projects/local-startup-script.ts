import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STARTUP_SCRIPT_RELATIVE_PATH = ".pstdio/startup.sh";

const startupScriptPath = (root: string) => join(root, STARTUP_SCRIPT_RELATIVE_PATH);

export const readLocalStartupScript = (root: string) => {
  const filePath = startupScriptPath(root);
  if (!existsSync(filePath)) {
    return null;
  }

  return readFileSync(filePath, "utf8");
};

export const writeLocalStartupScript = (root: string, content: string) => {
  const filePath = startupScriptPath(root);
  mkdirSync(join(root, ".pstdio"), { recursive: true });
  writeFileSync(filePath, content);
};

export const removeLocalStartupScript = (root: string) => {
  const filePath = startupScriptPath(root);
  if (!existsSync(filePath)) {
    return false;
  }

  rmSync(filePath);
  return true;
};

export const localStartupScriptRelativePath = STARTUP_SCRIPT_RELATIVE_PATH;

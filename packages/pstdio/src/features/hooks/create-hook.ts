import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HookName } from "pstdio-wt";

import { resolveFilesRoot } from "../resolve-files-root";

const HOOKS_DIR = join(".pstdio", "hooks");

const createGenericHookTemplate = (hookName: HookName) =>
  `#!/bin/sh

# .pstdio/hooks/${hookName}
# Add hook commands below.
`;

const readBundledHookTemplate = async (hookName: HookName) => {
  const filesRoot = await resolveFilesRoot();
  const templatePath = join(filesRoot, "hooks", hookName);
  if (!existsSync(templatePath)) return null;
  return readFileSync(templatePath, "utf8");
};

export const createHookFile = async (root: string, hookName: HookName) => {
  const hooksDir = join(root, HOOKS_DIR);
  mkdirSync(hooksDir, { recursive: true });

  const hookPath = join(hooksDir, hookName);
  if (existsSync(hookPath)) {
    throw new Error(`Hook already exists: "${hookName}"`);
  }

  const content = (await readBundledHookTemplate(hookName)) ?? createGenericHookTemplate(hookName);
  writeFileSync(hookPath, content, { mode: 0o755 });

  return hookPath;
};

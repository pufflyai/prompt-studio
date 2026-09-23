import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";

const runGit = promisify(execFile);
const commonDirectory = async (path: string) => {
  try {
    const { stdout } = await runGit("git", ["-C", path, "rev-parse", "--git-common-dir"]);
    return await realpath(resolve(path, stdout.trim()));
  } catch {
    return null;
  }
};

// Before providers existed, only isolation assigned both this branch and managed path.
export const resolveLegacyGitWorkspace = async (
  workspace: {
    provider_id: string;
    is_default?: boolean;
    branch?: string | null;
    workspace_shorthand?: string;
    worktree_path: string | null;
  },
  folders: Array<{ path: string }>,
) => {
  const path = workspace.worktree_path;
  if (
    workspace.provider_id !== "pstdio.root" ||
    workspace.is_default ||
    !path ||
    workspace.branch !== `workspace/${workspace.workspace_shorthand}` ||
    folders.some((folder) => folder.path === path)
  )
    return null;
  let expected: string;
  try {
    expected = await realpath(join(resolvePstdioWorkspacesPath(), workspace.workspace_shorthand!));
  } catch {
    return null;
  }
  if (path !== expected) return null;
  const common = await commonDirectory(path);
  if (!common) return null;
  for (const folder of folders) {
    if ((await commonDirectory(folder.path)) === common)
      return { version: 1, data: { sourceRoot: folder.path, worktreeRoot: path, relativePath: "" } };
  }
  return null;
};

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Keep the per-workspace config (and ticket cache) out of git inside the working dir,
// even if the project never committed a .pstdio/.gitignore.
const ensureConfigGitignore = async (pstdioDir: string) => {
  const gitignorePath = join(pstdioDir, ".gitignore");
  if (!existsSync(gitignorePath)) await writeFile(gitignorePath, "/tickets\nconfig.json\n");
};

// Stamps the host workspace id into the workspace's working-dir `.pstdio/config.json`
// so commands run from inside it resolve their workspace without a flag. Keyed on the
// working dir (not on "is it a worktree"), so worktree, root, and future cloud workspaces
// are handled uniformly through the provision lifecycle. The project config is the source
// of the other fields: it is copied in when the working dir has no config yet (a fresh
// worktree) and merged when it already does (the repo root). `.pstdio/config.json` is
// gitignored, so this never dirties a checkout.
export const ensureWorkspaceConfig = async (workspaceDir: string, repoPath: string, workspaceId: string) => {
  const pstdioDir = join(workspaceDir, ".pstdio");
  const dst = join(pstdioDir, "config.json");
  const src = existsSync(dst) ? dst : join(repoPath, ".pstdio", "config.json");
  if (!existsSync(src)) return;

  const base = JSON.parse(await readFile(src, "utf8"));
  await mkdir(pstdioDir, { recursive: true });
  await writeFile(dst, `${JSON.stringify({ ...base, workspace_id: workspaceId }, null, 2)}\n`);
  await ensureConfigGitignore(pstdioDir);
};

import { execFile } from "node:child_process";
import { realpath, rm } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import { promisify } from "node:util";
import type { PGlite } from "@electric-sql/pglite";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";

const git = promisify(execFile);

interface ArchivedWorkspace {
  id: string;
  project_id: string;
  provider_id: string;
  root_path: string | null;
  branch: string | null;
  provider_ref_json: { data: { sourceRoot?: string; worktreeRoot?: string } } | null;
}

const cleanupArchivedFolder = async (db: PGlite, workspace: ArchivedWorkspace) => {
  if (workspace.provider_id !== "pstdio.root" && workspace.provider_id !== "pstdio.worktree") return;
  const recorded = workspace.provider_ref_json?.data.worktreeRoot ?? workspace.root_path;
  if (!recorded) return;
  const root = await realpath(resolvePstdioWorkspacesPath());
  const path = await realpath(recorded);
  const rel = relative(root, path);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return;
  // Never remove a folder still owned by an active workspace, even for old root rows.
  const owners = await db.query<{ root_path: string }>(
    "SELECT root_path FROM workspaces WHERE deleted_at IS NULL AND NOT archived AND root_path IS NOT NULL",
  );
  for (const owner of owners.rows) {
    const activePath = await realpath(owner.root_path).catch(() => owner.root_path);
    const inside = relative(path, activePath);
    if (!inside || (!isAbsolute(inside) && inside !== ".." && !inside.startsWith(`..${sep}`))) return;
  }
  const sources = await db.query<{ root_path: string }>(
    "SELECT root_path FROM workspaces WHERE project_id = $1 AND is_default AND root_path IS NOT NULL",
    [workspace.project_id],
  );
  const source = workspace.provider_ref_json?.data.sourceRoot ?? sources.rows[0]?.root_path;
  if (source) {
    try {
      await git("git", ["-C", source, "worktree", "remove", path, "--force"]);
    } catch {
      // Archive already removed most worktrees. The remaining folder may only hold generated agent files.
    }
    if (workspace.branch) {
      await git("git", ["-C", source, "branch", "-D", workspace.branch]).catch(() => {});
    }
  }
  await rm(path, { recursive: true, force: true });
};

export const removeArchivedWorkspaces = async (db: PGlite) => {
  const state = await db.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'root_path') AS exists",
  );
  if (!state.rows[0]?.exists) return;
  const archived = await db.query<ArchivedWorkspace>(
    "SELECT id, project_id, provider_id, root_path, branch, provider_ref_json FROM workspaces WHERE archived AND deleted_at IS NULL",
  );
  for (const workspace of archived.rows) {
    try {
      await cleanupArchivedFolder(db, workspace);
    } catch (error) {
      console.warn(`Could not clean archived workspace ${workspace.id}: ${String(error)}`);
    }
  }
  const now = new Date().toISOString();
  await db.query("UPDATE workspaces SET deleted_at = $1, updated_at = $1 WHERE archived AND deleted_at IS NULL", [now]);
};

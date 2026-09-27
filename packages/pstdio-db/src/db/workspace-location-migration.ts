import { realpath } from "node:fs/promises";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { resolveLegacyGitWorkspace } from "./legacy-worktree";
import { folderWorkspaceCapabilities } from "./schemas/workspaces";

interface LegacyFolder {
  id: string;
  path: string;
  created_at: string;
  link_id: string;
}
interface LegacyWorkspace {
  worktree_path: string | null;
  name?: string;
  branch?: string | null;
  workspace_shorthand?: string;
  is_default?: boolean;
  deleted_at?: string | null;
  provider_id: string;
  execution_kind?: string;
  provider_params_json?: Record<string, unknown>;
  provider_ref_json?: { version: number; data: Record<string, unknown> } | null;
}

export const resolveLegacyWorkspaceLocation = (workspace: LegacyWorkspace, folders: LegacyFolder[]) => {
  if (workspace.execution_kind === "remote")
    return { rootPath: null, providerRef: workspace.provider_ref_json ?? null };
  const ordered = [...folders].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.link_id.localeCompare(b.link_id),
  );
  const repoId = workspace.provider_params_json?.repo_id ?? workspace.provider_ref_json?.data.repo_id;
  const source = (workspace.is_default ? undefined : ordered.find((folder) => folder.id === repoId)) ?? ordered[0];
  const rootPath =
    workspace.worktree_path ?? (workspace.provider_id === "pstdio.worktree" ? null : (source?.path ?? null));
  if (workspace.provider_id !== "pstdio.worktree")
    return { rootPath, providerRef: workspace.provider_ref_json ?? null };
  const recordedRef = workspace.provider_ref_json;
  if (typeof recordedRef?.data.sourceRoot === "string" && typeof recordedRef.data.worktreeRoot === "string")
    return { rootPath, providerRef: recordedRef };
  const providerRef =
    rootPath && source
      ? { version: 1, data: { sourceRoot: source.path, worktreeRoot: rootPath, relativePath: "" } }
      : null;
  return { rootPath, providerRef };
};

const canonicalRecordedPath = async (path: string) => {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
};

const prepareWorkspaceLocation = async (
  tx: Transaction,
  workspace: LegacyWorkspace & { id: string },
  canonicalFolders: LegacyFolder[],
) => {
  const recorded =
    workspace.worktree_path && workspace.execution_kind !== "remote"
      ? await canonicalRecordedPath(workspace.worktree_path)
      : workspace.worktree_path;
  const legacyGitRef = await resolveLegacyGitWorkspace({ ...workspace, worktree_path: recorded }, canonicalFolders);
  if (legacyGitRef) workspace.provider_id = "pstdio.worktree";
  const location = resolveLegacyWorkspaceLocation({ ...workspace, worktree_path: recorded }, canonicalFolders);
  if (legacyGitRef) location.providerRef = legacyGitRef;
  const params = { ...workspace.provider_params_json };
  if (workspace.provider_id === "pstdio.root" || workspace.provider_id === "pstdio.worktree") delete params.repo_id;
  await tx.query(
    "UPDATE workspaces SET worktree_path = $1, provider_ref_json = $2, provider_params_json = $3, provider_id = $5 WHERE id = $4",
    [location.rootPath, location.providerRef, params, workspace.id, workspace.provider_id],
  );
  if (workspace.provider_id === "pstdio.root") {
    await tx.query("UPDATE workspaces SET provider_capabilities_json = $1 WHERE id = $2", [
      folderWorkspaceCapabilities,
      workspace.id,
    ]);
  }
};

// Runs before the generated schema migration renames the path column and drops the
// repository tables. All inputs come from persisted host records; no local DB is opened here.
export const prepareWorkspaceLocations = async (db: PGlite) => {
  const shape = await db.query<{ ready: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'provider_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'worktree_path'
  ) AND to_regclass('public.project_repos') IS NOT NULL AS ready`);
  if (!shape.rows[0]?.ready) return;
  await db.transaction(async (tx) => {
    const projects = await tx.query<{ id: string; name: string }>("SELECT id, name FROM projects");
    for (const project of projects.rows) {
      const folders = await tx.query<LegacyFolder>(
        `SELECT r.id, r.path, pr.created_at, pr.id AS link_id FROM project_repos pr JOIN repos r ON r.id = pr.repo_id WHERE pr.project_id = $1 ORDER BY pr.created_at, pr.id`,
        [project.id],
      );
      const canonicalFolders = await Promise.all(
        folders.rows.map(async (folder) => ({ ...folder, path: await canonicalRecordedPath(folder.path) })),
      );
      const workspaces = await tx.query<LegacyWorkspace & { id: string; is_default: boolean }>(
        "SELECT * FROM workspaces WHERE project_id = $1",
        [project.id],
      );
      for (const workspace of workspaces.rows) await prepareWorkspaceLocation(tx, workspace, canonicalFolders);
      if (!workspaces.rows.some((workspace) => workspace.is_default) && canonicalFolders[0]) {
        const now = new Date().toISOString();
        const names = new Set(workspaces.rows.map((workspace) => workspace.name));
        let name = "Project folder";
        for (let suffix = 2; names.has(name); suffix += 1) name = `Project folder ${suffix}`;
        await tx.query(
          `INSERT INTO workspaces (id, project_id, name, worktree_path, provider_id, is_default, workspace_shorthand, provider_capabilities_json, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 'pstdio.root', true, 'default', $5, $6, $6)`,
          [crypto.randomUUID(), project.id, name, canonicalFolders[0].path, folderWorkspaceCapabilities, now],
        );
      }
    }
  });
};

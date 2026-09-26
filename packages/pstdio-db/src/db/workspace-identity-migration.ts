import type { PGlite } from "@electric-sql/pglite";
import { deriveShorthand } from "../services/projects/derive-shorthand";
import { isProjectPrefix, projectPrefixCandidate } from "../services/projects/project-prefix";

type Project = { id: string; name: string; shorthand: string };
type Workspace = {
  id: string;
  project_id: string;
  workspace_shorthand: string;
  is_default: boolean;
  worktree_path: string | null;
};
type ReferenceChange = { id: string; before: string; after: string };

export const needsWorkspaceIdentityMigration = async (db: PGlite) => {
  const { rows } = await db.query<{ needed: boolean }>(
    `SELECT to_regclass('public.projects') IS NOT NULL AND to_regclass('public.workspaces_workspace_shorthand_idx') IS NULL AS needed`,
  );
  return rows[0]?.needed ?? false;
};

const projectReferences = (projects: Project[]) => {
  const used = new Set<string>();
  const reserved = new Set(projects.map((project) => project.shorthand).filter(isProjectPrefix));
  return projects.map((project) => {
    let prefix = project.shorthand;
    if (!isProjectPrefix(prefix) || used.has(prefix)) {
      const base = deriveShorthand(project.name);
      let number = 1;
      do {
        prefix = projectPrefixCandidate(base, number++);
      } while (used.has(prefix) || reserved.has(prefix));
    }
    used.add(prefix);
    return { id: project.id, before: project.shorthand, after: prefix };
  });
};

const isCanonical = (workspace: Workspace, start: string) => {
  if (!workspace.workspace_shorthand.startsWith(start)) return false;
  const suffix = workspace.workspace_shorthand.slice(start.length);
  if (workspace.is_default) return suffix === "0";
  return /^[1-9]\d*$/.test(suffix) && Number.isSafeInteger(Number(suffix));
};

const workspaceReferences = (prefix: string, workspaces: Workspace[]) => {
  const start = `${prefix}_WS-`;
  const occupied = new Set(
    workspaces.filter((workspace) => isCanonical(workspace, start)).map((workspace) => workspace.workspace_shorthand),
  );
  const changes: ReferenceChange[] = [];
  let next = 1;
  for (const workspace of workspaces) {
    if (isCanonical(workspace, start)) continue;
    while (occupied.has(`${start}${next}`)) next++;
    const ref = workspace.is_default ? `${start}0` : `${start}${next++}`;
    occupied.add(ref);
    changes.push({ id: workspace.id, before: workspace.workspace_shorthand, after: ref });
  }
  return changes;
};

const sharedWorkspacePaths = (workspaces: Workspace[]) => {
  const paths = new Map<string, string[]>();
  for (const workspace of workspaces) {
    if (workspace.worktree_path)
      paths.set(workspace.worktree_path, [...(paths.get(workspace.worktree_path) ?? []), workspace.id]);
  }
  return [...paths].filter(([, ids]) => ids.length > 1).map(([path, workspaceIds]) => ({ path, workspaceIds }));
};

type MigrationEvidence = {
  projects: ReferenceChange[];
  workspaces: ReferenceChange[];
  sharedPaths: ReturnType<typeof sharedWorkspacePaths>;
};

export const normalizeWorkspaceIdentities = async (db: PGlite, saveEvidence?: (evidence: MigrationEvidence) => void) =>
  db.transaction(async (tx) => {
    const projects = (await tx.query<Project>("SELECT id, name, shorthand FROM projects ORDER BY created_at, id")).rows;
    const workspaces = (
      await tx.query<Workspace>(
        "SELECT id, project_id, workspace_shorthand, is_default, worktree_path FROM workspaces ORDER BY created_at, id",
      )
    ).rows;
    const references = projectReferences(projects);
    const evidence = {
      projects: references.filter((change) => change.before !== change.after),
      workspaces: references.flatMap((project) =>
        workspaceReferences(
          project.after,
          workspaces.filter((workspace) => workspace.project_id === project.id),
        ),
      ),
      sharedPaths: sharedWorkspacePaths(workspaces),
    };
    // Save the map before mutation so a crash cannot erase the previous public references.
    saveEvidence?.(evidence);
    // Temporary values avoid old per-project index collisions while renumbering.
    for (const change of evidence.workspaces)
      await tx.query("UPDATE workspaces SET workspace_shorthand = $1 WHERE id = $2", [
        `migration-${change.id}`,
        change.id,
      ]);
    for (const change of evidence.projects)
      await tx.query("UPDATE projects SET shorthand = $1 WHERE id = $2", [change.after, change.id]);
    for (const change of evidence.workspaces)
      await tx.query("UPDATE workspaces SET workspace_shorthand = $1 WHERE id = $2", [change.after, change.id]);
    return evidence;
  });

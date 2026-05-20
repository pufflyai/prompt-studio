import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/lib/sync/collections";
import { bool, isNotDeleted, str } from "@/lib/sync/row";

export interface SettingsProject {
  id: string;
  name: string;
}

export interface DashboardRepo {
  id: string;
  name: string;
  path: string;
}

export interface DashboardAgentConfig {
  id: string;
  agentId: string;
  isDefault: boolean;
}

export const toSettingsProject = (rows: SyncedRow[]): SettingsProject | undefined => {
  const row = rows.find(isNotDeleted);
  return row ? { id: row.id, name: str(row.name) ?? "Untitled project" } : undefined;
};

export const toProjectRepos = (links: SyncedRow[], repos: SyncedRow[]): DashboardRepo[] => {
  const repoById = new Map(repos.filter(isNotDeleted).map((row) => [row.id, row]));
  return links.filter(isNotDeleted).flatMap((link) => {
    const repo = repoById.get(String(link.repo_id));
    if (!repo) return [];
    return [{ id: repo.id, name: str(repo.display_name) ?? str(repo.name) ?? repo.id, path: str(repo.path) ?? "" }];
  });
};

export const toAgentConfigs = (rows: SyncedRow[]): DashboardAgentConfig[] =>
  rows.filter(isNotDeleted).map((row: SyncedRow) => ({
    id: row.id,
    agentId: str(row.agent_id) ?? row.id,
    isDefault: bool(row.is_default),
  }));

export const useSettingsProject = (projectId: string): SettingsProject | undefined => {
  const { data } = useLiveQuery((q) =>
    q
      .from({ p: getCollection("projects") })
      .where(({ p }) => eq(p.id, projectId))
      .select(({ p }) => ({ ...p })),
  );
  return toSettingsProject(asSyncedRows(data) ?? []);
};

export const useProjectRepos = (projectId: string): DashboardRepo[] => {
  const links = useLiveQuery((q) =>
    q
      .from({ pr: getCollection("project_repos") })
      .where(({ pr }) => eq(pr.project_id, projectId))
      .select(({ pr }) => ({ ...pr })),
  );
  const repos = useLiveQuery((q) => q.from({ r: getCollection("repos") }).select(({ r }) => ({ ...r })));

  return toProjectRepos(asSyncedRows(links.data) ?? [], asSyncedRows(repos.data) ?? []);
};

export const useAgentConfigs = (): DashboardAgentConfig[] => {
  const { data } = useLiveQuery((q) => q.from({ a: getCollection("agent_configs") }).select(({ a }) => ({ ...a })));
  return toAgentConfigs(asSyncedRows(data) ?? []);
};

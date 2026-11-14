import type { WorkspaceQuery } from "pstdio-api-contracts";
import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import type { z } from "zod";
import type { RouteDeps } from "../../features/deps";
import type { createPersonalIdentity } from "./identity";
import { type personalSessionSchema, personalWorkspaceSchema, remoteSession } from "./record-schemas";
import type { PersonalHistoryStore } from "./store";

export const createHistoryRecordQueries = (input: {
  context(projectId: string): Promise<{
    login: { accountId: string; deviceId: string };
    identity: string | undefined;
    history: PersonalHistoryStore;
  } | null>;
  account: ReturnType<typeof createPersonalIdentity>;
  projects: Pick<RouteDeps["projectService"], "list">;
  parseSession(row: Record<string, unknown>): z.infer<typeof personalSessionSchema>;
}) => {
  const queryWorkspaces = async (
    projectId: string,
    query: WorkspaceQuery & { shorthand?: string; includeArchived?: boolean } = {},
  ) => {
    const current = await input.context(projectId);
    if (!current) return { rows: [], nextCursor: null };
    const page = await current.history.queryWorkspaces(current.login, query);
    await input.account.read();
    if (current.identity !== input.account.version) return { rows: [], nextCursor: null };
    const rows = page.rows
      .map((row) => personalWorkspaceSchema.parse(row))
      .map((row) => {
        input.account.remember("workspaces", row.id, projectId);
        return row;
      });
    return { ...page, rows };
  };
  return {
    queryWorkspaces,
    async querySessions(projectId: string, query: ExtensionSessionQuery = {}, options: { unpaged?: boolean } = {}) {
      const current = await input.context(projectId);
      if (!current) return { rows: [], nextCursor: null };
      const page = await current.history.querySessions(current.login, query, options);
      await input.account.read();
      if (current.identity !== input.account.version) return { rows: [], nextCursor: null };
      const rows = page.rows
        .map(input.parseSession)
        .filter((row) => remoteSession(row, current.login, projectId))
        .map((row) => {
          input.account.remember("sessions", row.id, projectId);
          return { ...row, usage_json: row.usage_json ?? null };
        });
      return { ...page, rows };
    },
    async getWorkspace(id: string, projectId?: string) {
      const projects = projectId ? [{ id: projectId }] : await input.projects.list();
      for (const project of projects) {
        const current = await input.context(project.id);
        if (!current) continue;
        const row = await current.history.getRecord("workspaces", id);
        await input.account.read();
        if (!row || current.identity !== input.account.version) continue;
        const parsed = personalWorkspaceSchema.parse(row);
        if (
          parsed.device.ownerId !== current.login.accountId ||
          parsed.device.id === current.login.deviceId ||
          parsed.project_id !== project.id ||
          parsed.deleted_at
        )
          continue;
        input.account.remember("workspaces", id, project.id);
        return parsed;
      }
      return null;
    },
    async getWorkspaceByShorthand(projectId: string, shorthand: string) {
      const page = await queryWorkspaces(projectId, { shorthand, limit: 2, includeArchived: true });
      return page.rows.length === 1 ? page.rows[0]! : null;
    },
  };
};

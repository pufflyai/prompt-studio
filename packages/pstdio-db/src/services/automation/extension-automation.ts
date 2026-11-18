import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type AutomationRunStatus, automation_principals, automation_runs } from "../../db/schemas.pg";

export const createExtensionAutomationDBService = (db: DbClient) => {
  // The primary key makes concurrent creation safe without a second ownership column.
  const principalId = (input: { projectId: string; extensionId: string }) =>
    `extension:${JSON.stringify([input.projectId, input.extensionId])}`;

  const getOrCreateExtensionPrincipal = async (input: { projectId: string; extensionId: string }) => {
    const id = principalId(input);
    await db
      .insert(automation_principals)
      .values({
        id,
        project_id: input.projectId,
        name: input.extensionId,
        created_by: "extension",
        created_at: new Date().toISOString(),
        disabled_at: null,
      })
      .onConflictDoNothing();
    const [principal] = await db.select().from(automation_principals).where(eq(automation_principals.id, id));
    return principal;
  };
  const getExtensionRun = async (input: { projectId: string; extensionId: string }, runId: string) => {
    const [run] = await db
      .select()
      .from(automation_runs)
      .where(
        and(
          eq(automation_runs.project_id, input.projectId),
          eq(automation_runs.principal_id, principalId(input)),
          eq(automation_runs.id, runId),
        ),
      );
    return run;
  };
  const listExtensionRuns = (
    input: { projectId: string; extensionId: string },
    filter?: { status?: AutomationRunStatus[]; commandId?: string; limit?: number; order?: "oldest" | "newest" },
  ) => {
    if (filter?.limit !== undefined && (!Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 500))
      throw new Error("Automation activity needs a limit from 1 to 500");
    const order = filter?.order === "newest" ? desc : asc;
    const query = db
      .select()
      .from(automation_runs)
      .where(
        and(
          eq(automation_runs.project_id, input.projectId),
          eq(automation_runs.principal_id, principalId(input)),
          filter?.status ? inArray(automation_runs.status, filter.status) : undefined,
          filter?.commandId ? eq(automation_runs.command_id, filter.commandId) : undefined,
        ),
      )
      .orderBy(order(automation_runs.created_at), order(automation_runs.id));
    return filter?.limit === undefined ? query : query.limit(filter.limit);
  };
  return { getOrCreateExtensionPrincipal, getExtensionRun, listExtensionRuns };
};

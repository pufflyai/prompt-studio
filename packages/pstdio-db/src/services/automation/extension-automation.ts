import { and, asc, eq, inArray } from "drizzle-orm";
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
    filter?: { status?: AutomationRunStatus[] },
  ) =>
    db
      .select()
      .from(automation_runs)
      .where(
        and(
          eq(automation_runs.project_id, input.projectId),
          eq(automation_runs.principal_id, principalId(input)),
          filter?.status ? inArray(automation_runs.status, filter.status) : undefined,
        ),
      )
      .orderBy(asc(automation_runs.created_at), asc(automation_runs.id));
  return { getOrCreateExtensionPrincipal, getExtensionRun, listExtensionRuns };
};

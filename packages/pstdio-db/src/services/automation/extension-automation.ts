import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { type AutomationRunStatus, automation_runs } from "../../db/schemas.pg";
import { automationRunRecord, getExtensionAutomationOwner } from "./automation-owners";

export const createExtensionAutomationDBService = (db: DbClient) => {
  const getExtensionPrincipal = (input: { projectId: string; extensionId: string }) =>
    getExtensionAutomationOwner(db, input);
  const getExtensionRun = async (input: { projectId: string; extensionId: string }, runId: string) => {
    const [run] = await db
      .select()
      .from(automation_runs)
      .where(
        and(
          eq(automation_runs.project_id, input.projectId),
          eq(automation_runs.principal, `extension:${input.extensionId}`),
          eq(automation_runs.id, runId),
        ),
      );
    return run ? automationRunRecord(run) : undefined;
  };
  const listExtensionRuns = async (
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
          eq(automation_runs.principal, `extension:${input.extensionId}`),
          filter?.status ? inArray(automation_runs.status, filter.status) : undefined,
          filter?.commandId ? eq(automation_runs.command_id, filter.commandId) : undefined,
        ),
      )
      .orderBy(order(automation_runs.created_at), order(automation_runs.id));
    return (await (filter?.limit === undefined ? query : query.limit(filter.limit))).map(automationRunRecord);
  };
  return { getExtensionPrincipal, getExtensionRun, listExtensionRuns };
};

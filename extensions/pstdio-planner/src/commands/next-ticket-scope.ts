import type { CommandContext } from "@pstdio/sdk/extensions";
import { readAutoBuildEligibility } from "../data/auto-build-filter";
import type { AutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import type { StoredTicket } from "../data/types";
import type { readPlanCommand } from "../timeline/commands/read-plan";
import type { PlanRow } from "../timeline/contracts";
import { timelineQueryData } from "../timeline/model/query-data";
import { type NextTicketQuery, selectNextTicketRows, selectNextTicketScopeRows } from "./next-ticket-query";

interface ScopedWorkInput {
  plan: Awaited<ReturnType<typeof readPlanCommand.run>>;
  tickets: StoredTicket[];
  mode: AutoBuildMode;
  query: NextTicketQuery;
  scope?: NextTicketQuery[];
  completedStatusIds: string[];
  started: Set<string>;
}

// The supervisor's saved queries bound the work. Eligibility applies to new work.
export async function selectScopedWork(ctx: CommandContext, input: ScopedWorkInput) {
  const { plan, tickets, mode } = input;
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const data = timelineQueryData(plan, (_key, fallback) => fallback ?? _key);
  const { eligible, configurationError } = readAutoBuildEligibility(mode.eligible, data.rows, data.attributes);
  const supervisor = await readAutoBuildSupervisor(ctx);
  const savedScope =
    input.scope ?? (supervisor.scope?.revision === mode.revision ? supervisor.scope.queries : undefined);
  const isCompleted = (row: PlanRow) => input.completedStatusIds.includes(row.status?.id ?? "");
  const inQueries = await selectNextTicketScopeRows(ctx, plan, tickets, savedScope ?? [{}]);
  const queryIds = new Set(inQueries.map(({ id }) => id));
  // Started work stays in scope after its agent moves it out of the eligible statuses.
  const scoped = inQueries.filter(
    (row) => !byId.get(row.id)?.draft && (isCompleted(row) || eligible.has(row.id) || input.started.has(row.id)),
  );
  // Completion is derived, so reopening a scoped ticket clears it.
  const completed = Boolean(savedScope) && scoped.length > 0 && scoped.every(isCompleted);
  const selected = (await selectNextTicketRows(ctx, plan, tickets, input.query)).filter(
    (row) =>
      queryIds.has(row.id) &&
      (input.started.has(row.id) || (!configurationError && eligible.has(row.id))) &&
      !byId.get(row.id)?.draft &&
      !isCompleted(row),
  );
  return { selected, scoped, completed, configurationError };
}

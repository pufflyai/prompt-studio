import { resolveByIdOrName } from "@pstdio/sdk/data";
import type { CommandContext } from "@pstdio/sdk/extensions";
import type { NextTicketQuery } from "../data/auto-build-supervisor";
import { requireTickets, resolveStatusId, resolveTagOptionIds } from "../data/resolve";
import type { Ticket } from "../data/types";
import type { Plan, PlanRow } from "../timeline/contracts";

export type { NextTicketQuery } from "../data/auto-build-supervisor";

export async function selectNextTicketScopeRows(
  ctx: CommandContext,
  plan: Plan,
  tickets: Ticket[],
  queries: NextTicketQuery[],
) {
  const matches = await Promise.all(queries.map((query) => selectNextTicketRows(ctx, plan, tickets, query)));
  const ids = new Set(matches.flat().map(({ id }) => id));
  return plan.sections.flatMap(({ rows }) => rows).filter(({ id }) => ids.has(id));
}

export async function selectNextTicketRows(ctx: CommandContext, plan: Plan, tickets: Ticket[], input: NextTicketQuery) {
  const trackId = input.track
    ? resolveByIdOrName(plan.trackProperty?.options ?? [], input.track, (option) => option.name, "track")
    : undefined;
  const statusId = input.status ? await resolveStatusId(ctx.storage, input.status) : undefined;
  const tagIds = input.tags?.length ? await resolveTagOptionIds(ctx.storage, input.tags) : [];
  const parentIds = input.parent ? new Set((await requireTickets(ctx, input.parent)).map(({ id }) => id)) : undefined;
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  return plan.sections
    .flatMap(({ rows }) => rows)
    .filter((row: PlanRow) => {
      if (trackId !== undefined && row.trackId !== trackId) return false;
      if (statusId !== undefined && row.status?.id !== statusId) return false;
      if (!tagIds.every((id) => row.tagIds.includes(id))) return false;
      return parentIds === undefined || parentIds.has(byId.get(row.id)?.parentId ?? "");
    });
}

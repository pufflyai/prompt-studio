import { resolveByIdOrName } from "@pstdio/sdk/data";
import type { CommandContext } from "@pstdio/sdk/extensions";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import type { StoredTicket } from "../data/types";
import type { Plan, PlanRow } from "../timeline/contracts";

export interface NextTicketQuery {
  track?: string;
  status?: string;
  tags?: string[];
  parent?: string;
}

export async function selectNextTicketRows(
  ctx: CommandContext,
  plan: Plan,
  tickets: StoredTicket[],
  input: NextTicketQuery,
) {
  const trackId = input.track
    ? resolveByIdOrName(plan.trackProperty?.options ?? [], input.track, (option) => option.name, "track")
    : undefined;
  const statusId = input.status ? await resolveStatusId(ctx.storage, input.status) : undefined;
  const tagIds = input.tags?.length ? await resolveTagOptionIds(ctx.storage, input.tags) : [];
  const parentId = input.parent ? await resolveTicketId(ctx.storage, input.parent) : undefined;
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  return plan.sections
    .flatMap(({ rows }) => rows)
    .filter((row: PlanRow) => {
      if (trackId !== undefined && row.trackId !== trackId) return false;
      if (statusId !== undefined && row.status?.id !== statusId) return false;
      if (!tagIds.every((id) => row.tagIds.includes(id))) return false;
      return parentId === undefined || byId.get(row.id)?.parentId === parentId;
    });
}

import type { readTicketViewPage } from "../../data/query-ticket-page";
import type { PlanRow } from "../contracts";

const attentionFlags = new Set(["review-needed", "waiting", "blocked", "overdue", "due-soon"]);

/** Reuse the same review counts and dependency flags as the visible plan rows. */
export const planTicketRows = (view: Awaited<ReturnType<typeof readTicketViewPage>>, rows: PlanRow[]) => {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return view.result.rows.map((ticket) => {
    const row = byId.get(ticket.id)!;
    const attention =
      !row.done &&
      (row.flags.some((flag) => attentionFlags.has(flag)) ||
        view.projections.get(ticket.id)?.hasUnfinishedDependent === true);
    return { ...ticket, attributes: { ...ticket.attributes, needsAttention: attention ? "yes" : "no" } };
  });
};

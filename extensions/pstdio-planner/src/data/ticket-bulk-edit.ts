import { publishTicketChanges } from "./ticket-activity";
import type { TicketContext } from "./ticket-identity";
import { changeTicketRecord } from "./ticket-records";
import { inBatches, ticketKeyPages } from "./ticket-selection";
import { queueTicketWrite } from "./ticket-write-queue";
import type { StoredTicket } from "./types";

export const reassignTicketStatuses = async (ctx: TicketContext, removed: string[], fallback: string | null) => {
  if (!removed.length) return;
  const selected = new Set(removed);
  for await (const page of ticketKeyPages(
    ctx.storage,
    { field: "statusId", op: "in", value: removed },
    "ticket-status",
  )) {
    await inBatches(page, ({ fields }) =>
      queueTicketWrite(String(fields.id), async () => {
        let before: StoredTicket | undefined;
        const changed = await changeTicketRecord(ctx.storage, String(fields.id), (current) => {
          before = undefined;
          if (!selected.has(current.statusId ?? "")) return current;
          before = current;
          return { ...current, statusId: fallback, updatedAt: new Date().toISOString() };
        });
        if (before && changed) await publishTicketChanges(ctx, before, changed);
      }),
    );
  }
};

import type { StoragePredicate } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import type { TicketContext } from "./ticket-identity";
import { missingTicketPosition, ticketSelectionPage } from "./ticket-selection";

const active: StoragePredicate = { field: "archived", op: "eq", value: false };

export const appendTicketPositionFromStorage = async (storage: TicketContext["storage"]) => {
  if (
    (await ticketSelectionPage(storage, { index: "ticket-missing-position", where: missingTicketPosition, limit: 1 }))
      .records.length
  )
    throw new Error("Ticket order is waiting for the synced Planner update.");
  const last = (await ticketSelectionPage(storage, { index: "ticket-active-order", where: active, limit: 1 }))
    .records[0];
  return storage.positions.between(last ? String(last.fields.position) : undefined);
};

export const readTicketOrderChange = async (ctx: TicketContext, rowId: string, beforeRowId?: string) => {
  const records = ticketsCollection(ctx);
  const moving = await records.get(rowId);
  if (!moving || moving.archived || rowId === beforeRowId) return [];
  const target = beforeRowId ? await records.get(beforeRowId) : undefined;
  const before = target && !target.archived ? target : undefined;
  if (!moving.position || (before && !before.position))
    throw new Error("Ticket order is waiting for the synced Planner update.");
  const previous = (
    await ticketSelectionPage(ctx.storage, {
      index: "ticket-active-order",
      limit: 1,
      where: {
        all: [
          active,
          { field: "id", op: "ne", value: rowId },
          ...(before ? [{ field: "position", op: "lt", value: before.position! } satisfies StoragePredicate] : []),
        ],
      },
    })
  ).records[0];
  const lower = previous ? String(previous.fields.position) : undefined;
  if ((!lower || moving.position > lower) && (!before || moving.position < before.position!)) return [];
  return [{ ...moving, position: ctx.storage.positions.between(lower, before?.position) }];
};

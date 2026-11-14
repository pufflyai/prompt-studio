import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { changeTicketRecord } from "./ticket-records";
import { inBatches, ticketKeyPages } from "./ticket-selection";
import { queueTicketWrite } from "./ticket-write-queue";

export const reassignTicketStatuses = async (
  storage: ExtensionStorageApi,
  removed: string[],
  fallback: string | null,
) => {
  if (!removed.length) return;
  const selected = new Set(removed);
  for await (const page of ticketKeyPages(storage, { field: "statusId", op: "in", value: removed }, "ticket-status")) {
    await inBatches(page, ({ fields }) =>
      queueTicketWrite(String(fields.id), () =>
        changeTicketRecord(storage, String(fields.id), (current) =>
          selected.has(current.statusId ?? "") ? { ...current, statusId: fallback } : current,
        ),
      ),
    );
  }
};

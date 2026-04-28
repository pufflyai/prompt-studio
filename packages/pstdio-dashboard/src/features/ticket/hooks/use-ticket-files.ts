import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";
import { plannerCollectionRows, toPlannerTicketFiles } from "@/features/ticket-list/hooks/planner-extension-rows";

export const useTicketFiles = (ticketId: string | null | undefined) => {
  const { data: rawPlannerItems, isLoading } = useLiveQuery(
    (q) =>
      ticketId
        ? q
            .from({ item: getCollection("extension_collection_items") })
            .where(({ item }) => eq(item.collection, "tickets"))
            .select(({ item }) => ({ ...item }))
        : undefined,
    [ticketId],
  );
  const { data: rawFilesData } = useLiveQuery(
    (q) => (ticketId ? q.from({ file: getCollection("files") }).select(({ file }) => ({ ...file })) : undefined),
    [ticketId],
  );
  const plannerItems = asSyncedRows(rawPlannerItems);
  const rawFiles = asSyncedRows(rawFilesData);
  const ticketItem = plannerCollectionRows(plannerItems, "tickets", undefined).find(
    (item) => item.item_id === ticketId,
  );
  const { files, artifacts } = toPlannerTicketFiles(ticketItem, rawFiles);

  const data = ticketId ? { files, artifacts } : undefined;

  return { data, isLoading };
};

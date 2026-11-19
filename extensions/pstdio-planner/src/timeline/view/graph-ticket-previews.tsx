import { viewDataEvents } from "@pstdio/sdk/extensions";
import { useScopedQueries, useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { useEffect, useState } from "react";
import {
  TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE,
  TICKET_LINKED_RESOURCES_ATTRIBUTE,
} from "../../data/ticket-linked-resources";
import { plannerTicketsChanged } from "../planner";
import type { TicketCardInteraction } from "./ticket-card-interaction";

const events = [plannerTicketsChanged, viewDataEvents.resourceAnchorsChanged, viewDataEvents.resourcesChanged];

export function useGraphTicketPreviews(
  interaction: Pick<TicketCardInteraction, "client" | "rows">,
  ticketIds: string[],
) {
  const { client } = interaction;
  const scope = useWebviewScope(client.queries);
  const visible = useWebviewVisibility();
  const ids = [...new Set(ticketIds)].sort();
  const selection = JSON.stringify([scope, ids]);
  const queries: ReturnType<(typeof client.commands)["timeline.ticket-previews"]["query"]>[] = [];
  for (let offset = 0; offset < ids.length; offset += 100)
    queries.push(
      client.commands["timeline.ticket-previews"].query({ ticketIds: ids.slice(offset, offset + 100) }, { events }),
    );
  const snapshots = useScopedQueries(queries, visible);
  const [admission, setAdmission] = useState<{ client: typeof client; selection: string; abort: AbortController }>();
  useEffect(() => {
    if (!visible) return;
    const owner = new AbortController();
    setAdmission({ client, selection, abort: owner });
    return () => owner.abort();
  }, [client, selection, visible]);
  const rows = new Map(interaction.rows);
  for (const snapshot of snapshots)
    for (const preview of snapshot.data ?? []) {
      const source = rows.get(preview.id);
      if (source)
        rows.set(preview.id, {
          ...source,
          attributes: {
            ...source.attributes,
            [TICKET_LINKED_RESOURCES_ATTRIBUTE]: preview.attributes[TICKET_LINKED_RESOURCES_ATTRIBUTE],
            [TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE]: preview.attributes[TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE],
          },
        });
    }
  const error = snapshots.find((snapshot) => snapshot.error)?.error;
  const retry = () => {
    if (
      !visible ||
      !admission ||
      admission.client !== client ||
      admission.selection !== selection ||
      admission.abort.signal.aborted
    )
      return;
    for (const query of queries) if (!query.isDisposed()) void query.refresh(admission.abort.signal).catch(() => {});
  };
  return {
    rows,
    error,
    retry,
  };
}

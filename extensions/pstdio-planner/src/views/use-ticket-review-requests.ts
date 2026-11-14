import type { createWebviewClient, ResourceRef } from "@pstdio/sdk/extensions";
import { useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { useLayoutEffect, useState } from "react";
import type { listReviewRequestsCommand, openReviewRequestCommand, reviewCommand } from "../commands/review-requests";
import { plannerTicketsChanged } from "../events";
import { usePlannerQuery } from "../timeline/view/use-planner-query";

export type TicketRequestsCommands = {
  "review-requests.list": typeof listReviewRequestsCommand;
  review: typeof reviewCommand;
  "review-requests.open": typeof openReviewRequestCommand;
};
export type TicketRequestsClient = ReturnType<typeof createWebviewClient<TicketRequestsCommands>>;
const events = [plannerTicketsChanged];

export const useTicketRequests = (client: TicketRequestsClient, resource: ResourceRef) => {
  const scope = useWebviewScope(client.queries);
  const query = client.commands["review-requests.list"].query(
    { ticket: resource.id },
    { resource, events, dependency: { resourceId: resource.id } },
  );
  const state = usePlannerQuery(client, query);
  const visible = useWebviewVisibility();
  const [owner, setOwner] = useState<{ query: typeof query; abort: AbortController }>();
  useLayoutEffect(() => {
    if (!visible) return;
    const abort = new AbortController();
    setOwner({ query, abort });
    return () => abort.abort();
  }, [query, visible]);
  const run = async (action: () => Promise<unknown>) => {
    if (
      !visible ||
      !owner ||
      owner.query !== query ||
      owner.abort.signal.aborted ||
      client.queries.getScope() !== scope
    )
      return;
    return action();
  };
  const answer = (requestId: string, response: Parameters<TicketRequestsClient["commands"]["review"]>[0]["response"]) =>
    run(() => client.commands.review({ requestId, response }));
  const openChat = (requestId: string) => run(() => client.commands["review-requests.open"]({ requestId }));
  return { ...state, answer, openChat };
};

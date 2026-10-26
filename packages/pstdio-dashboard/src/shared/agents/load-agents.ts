import type { AgentClient } from "@pstdio/sdk/client";
import type { AgentDetails } from "pstdio-api-contracts";

export const loadAgents = async (agents: Pick<AgentClient, "query">, projectId?: string, signal?: AbortSignal) => {
  const items: AgentDetails[] = [];
  let cursor: string | undefined;
  do {
    signal?.throwIfAborted();
    const page = await agents.query(projectId, { cursor });
    signal?.throwIfAborted();
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
};

import type { AgentClient } from "@pstdio/sdk/client";
import type { AgentDetails } from "pstdio-api-contracts";

export const loadAgents = async (agents: Pick<AgentClient, "query">, projectId?: string) => {
  const items: AgentDetails[] = [];
  let cursor: string | undefined;
  do {
    const page = await agents.query(projectId, { cursor });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
};

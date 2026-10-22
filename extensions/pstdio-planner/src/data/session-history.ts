import type { ExtensionSessionPage, ExtensionSessionQuery, ExtensionSessionsApi } from "@pstdio/sdk/extensions";

// Planner selects the most recent entry with at(-1), so keep history oldest first across query pages.
export const readSessionHistory = async (
  sessions: Pick<ExtensionSessionsApi, "query">,
  input: Omit<ExtensionSessionQuery, "cursor" | "limit"> = {},
) => {
  const history: ExtensionSessionPage["items"] = [];
  let cursor: string | undefined;
  do {
    const page = await sessions.query({
      ...(input.workspaceId ? { includeArchived: true } : {}),
      ...input,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    history.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return history.reverse();
};

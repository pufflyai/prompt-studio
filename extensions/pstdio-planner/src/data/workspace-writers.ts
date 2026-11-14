import type { ExtensionSessionsApi } from "@pstdio/sdk/extensions";

export const hasWorkspaceWriter = async (
  sessions: Pick<ExtensionSessionsApi, "query">,
  workspaceId: string,
  exceptSessionId?: string,
) => {
  // At most one result can be the excluded owner; a second proves competition.
  const page = await sessions.query({
    workspaceId,
    status: ["queued", "in_progress", "awaiting_input"],
    includeArchived: true,
    limit: exceptSessionId ? 2 : 1,
  });
  return page.items.some(({ id }) => id !== exceptSessionId);
};

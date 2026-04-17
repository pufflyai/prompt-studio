export const validateWorkspaceRouteSearch = (search: Record<string, unknown>) => ({
  sessionId: typeof search.sessionId === "string" ? search.sessionId : undefined,
  tab: typeof search.tab === "string" ? search.tab : undefined,
});

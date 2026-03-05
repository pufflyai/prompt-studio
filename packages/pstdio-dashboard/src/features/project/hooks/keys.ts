export const projectKeys = {
  all: ["projects"] as const,
  info: () => ["system", "info"] as const,
  detail: (projectId: string) => ["projects", projectId] as const,
  tickets: (projectId: string) => ["projects", projectId, "tickets"] as const,
  sessions: (projectId: string) => ["projects", projectId, "sessions"] as const,
  session: (projectId: string, sessionId: string) => ["projects", projectId, "sessions", sessionId] as const,
  ticketStatuses: (projectId: string) => ["projects", projectId, "ticket-statuses"] as const,
  ticketTags: (projectId: string) => ["projects", projectId, "ticket-tags"] as const,
  repositories: (projectId: string) => ["projects", projectId, "repositories"] as const,
  templateAssets: (projectId: string) => ["projects", projectId, "template-assets"] as const,
};

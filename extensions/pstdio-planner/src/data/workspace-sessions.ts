import type { ExtensionSessionsApi, ExtensionWorkspace } from "@pstdio/sdk/extensions";

type WorkspaceSession = Awaited<ReturnType<ExtensionSessionsApi["query"]>>["items"][number];

export type TicketWorkspaceSession = Pick<WorkspaceSession, "id" | "status">;
export type TicketWorkspaceSessionLookup = Map<string, TicketWorkspaceSession>;

let activeLookups = 0;
const waitingLookups: (() => void)[] = [];

const latestWorkspaceSession = async (sessions: Pick<ExtensionSessionsApi, "query">, workspaceId: string) => {
  // A refresh can overlap another view's refresh. Share the read limit between them.
  if (activeLookups >= 4) await new Promise<void>((resolve) => waitingLookups.push(resolve));
  else activeLookups++;
  try {
    const input = { workspaceId, includeArchived: true, limit: 1 };
    const active = await sessions.query({ ...input, status: ["queued", "in_progress", "awaiting_input"] });
    if (active.items[0]) return active.items[0];
    return (await sessions.query(input)).items[0];
  } finally {
    const next = waitingLookups.shift();
    if (next) next();
    else activeLookups--;
  }
};

// The board only ever shows workspaces linked to a ticket, so unlinked ones stay out of the fan-out.
const linkedWorkspaceIds = (workspaces: ExtensionWorkspace[]) =>
  new Set(
    workspaces
      .filter((workspace) => (workspace.anchors_json ?? []).some(({ type }) => type === "ticket"))
      .map((workspace) => workspace.id),
  );

// Queries are newest-first. Only fetch the row the badge needs, not its full history.
export const loadLatestWorkspaceSessions = async (
  sessions: Pick<ExtensionSessionsApi, "query">,
  workspaces: ExtensionWorkspace[],
): Promise<TicketWorkspaceSessionLookup> => {
  const entries = await Promise.all(
    [...linkedWorkspaceIds(workspaces)].map(async (workspaceId) => {
      const latest = await latestWorkspaceSession(sessions, workspaceId);
      return latest ? ([workspaceId, { id: latest.id, status: latest.status }] as const) : null;
    }),
  );

  return new Map(entries.filter((entry) => entry !== null));
};

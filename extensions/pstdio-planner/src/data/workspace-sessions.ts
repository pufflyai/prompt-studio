import type { ExtensionSessionsApi, ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { ticketShorthandFromWorkspace } from "./workspace-ticket-link";

type WorkspaceSession = Awaited<ReturnType<ExtensionSessionsApi["listByWorkspace"]>>[number];

export type TicketWorkspaceSession = Pick<WorkspaceSession, "id" | "status">;
export type TicketWorkspaceSessionLookup = Map<string, TicketWorkspaceSession>;

// The board only ever shows workspaces linked to a ticket, so unlinked ones stay out of the fan-out.
const linkedWorkspaceIds = (workspaces: ExtensionWorkspace[]) =>
  new Set(workspaces.filter((workspace) => ticketShorthandFromWorkspace(workspace)).map((workspace) => workspace.id));

// Sessions are oldest-first. Prefer ongoing work before falling back to the latest result.
export const loadLatestWorkspaceSessions = async (
  sessions: Pick<ExtensionSessionsApi, "listByWorkspace">,
  workspaces: ExtensionWorkspace[],
): Promise<TicketWorkspaceSessionLookup> => {
  const entries = await Promise.all(
    [...linkedWorkspaceIds(workspaces)].map(async (workspaceId) => {
      const all = await sessions.listByWorkspace(workspaceId);
      const latest =
        all.findLast(
          (session) =>
            session.status === "queued" || session.status === "in_progress" || session.status === "awaiting_input",
        ) ?? all.at(-1);
      return latest ? ([workspaceId, { id: latest.id, status: latest.status }] as const) : null;
    }),
  );

  return new Map(entries.filter((entry) => entry !== null));
};

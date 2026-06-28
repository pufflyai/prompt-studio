import { defineCommand, type ExtensionSessionSummary, params } from "@pstdio/sdk/extensions";

type SessionStatus = ExtensionSessionSummary["status"];

// Statuses that count as "the workspace still has live work happening". A
// session in any of these states keeps the workspace active and gates the
// stuck-work sweep so it does not move tickets out from under a running agent.
const LIVE_SESSION_STATUSES = new Set<SessionStatus>(["in_progress", "awaiting_input", "queued"]);

interface WorkspaceActivitySession {
  id: string;
  title: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

const toActivitySession = (session: ExtensionSessionSummary): WorkspaceActivitySession => ({
  id: session.id,
  title: session.title,
  status: session.status,
  createdAt: session.created_at,
  updatedAt: session.updated_at,
});

// Returns a live snapshot of the sessions anchored to a workspace and whether
// any of them are still running. Replaces the stored `workspace-status-values`
// proxy; the automation extension reads this to decide if work is stuck or
// review-ready, and other extensions can use it to render a status badge.
export const workspaceActivityCommand = defineCommand({
  title: "Workspace activity",
  params: {
    workspaceId: params.text({ required: true }),
  },
  async run(ctx) {
    const sessions = await ctx.sessions.list({ workspaceId: ctx.params.workspaceId });
    const visible = sessions.filter((session) => !session.archived);
    const active = visible.some((session) => LIVE_SESSION_STATUSES.has(session.status));
    return {
      active,
      sessions: visible.map(toActivitySession),
    };
  },
});

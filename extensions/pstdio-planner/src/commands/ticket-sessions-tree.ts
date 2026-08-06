import type { ResourceAnchor, TreeNode, TreeViewSection } from "@pstdio/sdk/extensions";

// The shape the host's `ctx.sessions.list()` returns; only the fields the sidenav needs.
export interface TicketSession {
  id: string;
  title: string;
  status: string;
  last_request_started?: string | null;
  last_request_ended?: string | null;
  updated_at?: string | null;
  anchors_json?: ResourceAnchor[];
}

// Refine / Break into sub-tickets / Run attempt sessions anchor themselves to the ticket via a
// `type: "ticket"` entry in their anchors, so the sidenav lists exactly the ticket's own sessions.
const isAnchoredToTicket = (session: TicketSession, ticketId: string) =>
  (session.anchors_json ?? []).some((anchor) => anchor.type === "ticket" && anchor.id === ticketId);

const sessionStatusIcon = (status: string) => {
  if (status === "completed") return "CircleCheck";
  if (status === "failed") return "CircleAlert";
  if (status === "cancelled" || status === "disconnected") return "CirclePause";
  if (status === "queued") return "ClockAlert";
  if (status === "awaiting_input") return "CircleDot";
  return "CircleDashed";
};

const sessionStatusColor = (status: string) => {
  if (status === "completed") return "fg.success";
  if (status === "failed") return "fg.error";
  if (status === "cancelled" || status === "disconnected") return "fg.warning";
  if (status === "queued") return "fg.info";
  return "fg.muted";
};

const sessionActivityAt = (session: TicketSession) =>
  session.last_request_ended ?? session.last_request_started ?? session.updated_at ?? "";

const sessionNode = (session: TicketSession): TreeNode => ({
  id: `session-${session.id}`,
  label: session.title,
  icon: sessionStatusIcon(session.status),
  iconColor: sessionStatusColor(session.status),
  // The `sessionSurface: "side"` hint tells the dashboard to open the session in its
  // Side Panel (keeping the ticket in panel) instead of switching to sessions mode.
  target: {
    kind: "resource",
    resource: { type: "session", id: session.id, label: session.title, metadata: { sessionSurface: "side" } },
  },
});

const emptySessionsNode = (): TreeNode => ({
  id: "sessions-empty",
  label: "No sessions",
  icon: "MessageCircle",
  disabled: true,
  rowVariant: "empty-state",
});

export interface BuildSessionsSectionInput {
  sessions: TicketSession[];
  ticketId: string;
  // Sessions of the workspaces linked to the ticket — the attempts made on it.
  workspaceSessions?: TicketSession[];
}

export const buildSessionsSection = (input: BuildSessionsSectionInput): TreeViewSection => {
  const byId = new Map<string, TicketSession>();
  for (const session of input.sessions) {
    if (isAnchoredToTicket(session, input.ticketId)) byId.set(session.id, session);
  }
  for (const session of input.workspaceSessions ?? []) byId.set(session.id, session);

  const ticketSessions = [...byId.values()].sort((a, b) => sessionActivityAt(b).localeCompare(sessionActivityAt(a)));

  return {
    id: "sessions",
    label: "Sessions",
    collapsible: true,
    nodes: ticketSessions.length === 0 ? [emptySessionsNode()] : ticketSessions.map(sessionNode),
  };
};

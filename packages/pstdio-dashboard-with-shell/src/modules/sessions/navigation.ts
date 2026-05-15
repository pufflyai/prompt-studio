import { resolveSessionIndicatorColor, resolveSessionIndicatorIcon, type SessionCompletionStatus } from "@pstdio/ui";
import type { TreeNode, TreeViewSection } from "pstdio-shell/core";
import { createElement } from "react";
import { SESSIONS_ICON } from "./constants";
import { createSessionResource, createSessionsResource } from "./resources";
import type { Session } from "./types";

interface CreateSessionsNavigationSectionsInput {
  projectId: string;
  sessions: Session[];
  onOpenSessions: () => void;
  onArchiveSession: (sessionId: string) => void;
  onCopyAgentSessionId: (agentSessionId: string) => void;
}

const formatSessionStatusLabel = (status: string) =>
  status
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");

const getDateLabel = (date: Date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (target === today) return "Today";
  if (target === today - dayMs) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const groupSessionsByDate = (sessions: Session[]) => {
  const groups: { label: string; sessions: Session[] }[] = [];

  for (const session of sessions) {
    const label = getDateLabel(new Date(session.updatedAt));
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.label === label) {
      lastGroup.sessions.push(session);
    } else {
      groups.push({ label, sessions: [session] });
    }
  }

  return groups;
};

const createSessionContextMenuActions = (
  input: CreateSessionsNavigationSectionsInput,
  session: Session,
): TreeNode["contextMenuActions"] => [
  ...(session.agentSessionId
    ? [
        {
          id: `copy-agent-session-id:${session.id}`,
          label: "Copy agent session ID",
          icon: "Copy",
          run: () => input.onCopyAgentSessionId(session.agentSessionId ?? ""),
        },
      ]
    : []),
  {
    id: `archive-session:${session.id}`,
    label: "Archive session",
    icon: "Archive",
    run: () => input.onArchiveSession(session.id),
  },
];

const createSessionNode = (input: CreateSessionsNavigationSectionsInput, session: Session): TreeNode => ({
  id: `session:${session.id}`,
  label: session.title,
  iconElement: createElement(resolveSessionIndicatorIcon(session.status as SessionCompletionStatus), { size: 14 }),
  iconColor: resolveSessionIndicatorColor(session.status as SessionCompletionStatus),
  iconTooltip: formatSessionStatusLabel(session.status),
  resource: createSessionResource(input.projectId, session.id, session.title),
  contextMenuActions: createSessionContextMenuActions(input, session),
});

export const createSessionsNavigationSections = (input: CreateSessionsNavigationSectionsInput): TreeViewSection[] => [
  {
    id: "sessions",
    nodes: [
      {
        id: "sessions:new",
        label: "New session",
        icon: "PenBox",
        resource: createSessionsResource(input.projectId),
      },
      ...(input.sessions.length === 0
        ? [
            {
              id: "sessions:empty",
              label: "No sessions yet",
              icon: SESSIONS_ICON,
              disabled: true,
            },
          ]
        : []),
    ],
    actions: [{ id: "new-session", label: "New session", icon: "Plus", run: input.onOpenSessions }],
  },
  ...groupSessionsByDate(input.sessions).map((group) => ({
    id: group.label,
    label: group.label,
    collapsible: false,
    nodes: group.sessions.map((session) => createSessionNode(input, session)),
  })),
];

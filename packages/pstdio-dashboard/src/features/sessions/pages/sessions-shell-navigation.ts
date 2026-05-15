import { resolveSessionIndicatorColor, resolveSessionIndicatorIcon, type SessionCompletionStatus } from "@pstdio/ui";
import type { TreeNode, TreeViewSection } from "pstdio-shell/core";
import { createElement } from "react";
import { createSessionResource, createSessionsResource } from "@/shared/shell/dashboard-sessions-shell";
import type { Session } from "../types";
import { groupSessionsByDate } from "../utils/group-sessions";

interface CreateSessionsNavigationSectionsInput {
  projectId: string;
  sessions: Session[];
  onArchiveSession: (sessionId: string) => void;
  onCreateSession: () => void;
}

const formatSessionStatusLabel = (status: string) =>
  status
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");

const createSessionNode = (
  projectId: string,
  session: Session,
  onArchiveSession: (sessionId: string) => void,
): TreeNode => ({
  id: `session:${session.id}`,
  label: session.title,
  iconElement: createElement(resolveSessionIndicatorIcon(session.status as SessionCompletionStatus), { size: 14 }),
  iconColor: resolveSessionIndicatorColor(session.status as SessionCompletionStatus),
  iconTooltip: formatSessionStatusLabel(session.status),
  resource: createSessionResource(projectId, session.id, session.title),
  actions: [
    {
      id: `archive-session:${session.id}`,
      label: "Archive session",
      icon: "Archive",
      run: () => onArchiveSession(session.id),
    },
  ],
});

export const createSessionsNavigationSections = (input: CreateSessionsNavigationSectionsInput): TreeViewSection[] => {
  const groups = groupSessionsByDate(input.sessions);
  const sessionSections = groups.map((group) => ({
    id: group.label,
    label: group.label,
    collapsible: false,
    nodes: group.sessions.map((session) => createSessionNode(input.projectId, session, input.onArchiveSession)),
  }));

  return [
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
                icon: "MessageCircle",
                disabled: true,
              },
            ]
          : []),
      ],
      actions: [{ id: "new-session", label: "New session", icon: "Plus", run: input.onCreateSession }],
    },
    ...sessionSections,
  ];
};

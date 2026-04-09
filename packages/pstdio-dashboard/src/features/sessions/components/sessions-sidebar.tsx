import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
  Sidebar,
  type SidebarNavigateEvent,
  type SidebarSection,
} from "@pstdio/ui";
import { createElement } from "react";
import { BackToDashboard } from "@/features/project/components/back-to-dashboard";
import type { Session } from "../types";
import { groupSessionsByDate } from "../utils/group-sessions";

const SESSIONS_SIDEBAR_STORAGE_KEY = "sessions-sidebar";

const sessionIcon = (status: string) =>
  createElement(resolveSessionIndicatorIcon(status as SessionCompletionStatus), { size: 14 });

interface SessionsSidebarProps {
  sessions: Session[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

const buildSections = (sessions: Session[]): SidebarSection[] => {
  const groups = groupSessionsByDate(sessions);

  return groups.map((group) => ({
    id: group.label,
    label: group.label,
    collapsible: false,
    nodes: group.sessions.map((session) => ({
      id: session.id,
      label: session.title,
      icon: sessionIcon(session.status),
      iconColor: resolveSessionIndicatorColor(session.status as SessionCompletionStatus),
      isNavigable: true,
      navigationIntent: { id: "select-session", payload: session.id },
    })),
  }));
};

export const SessionsSidebar = (props: SessionsSidebarProps) => {
  const { sessions, selectedSessionId, onSelectSession } = props;

  const sections = buildSections(sessions);

  const handleNavigate = (event: SidebarNavigateEvent) => {
    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "select-session") {
      onSelectSession(intent.payload as string);
    }
  };

  return (
    <Sidebar
      storageKey={SESSIONS_SIDEBAR_STORAGE_KEY}
      sections={sections}
      activeNodeId={selectedSessionId}
      header={<BackToDashboard />}
      onNavigate={handleNavigate}
      closable={false}
      width="18rem"
      emptyLabel="No sessions yet"
    />
  );
};

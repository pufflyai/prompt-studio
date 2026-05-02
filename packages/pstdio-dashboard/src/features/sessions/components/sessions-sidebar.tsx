import { HStack, IconButton } from "@chakra-ui/react";
import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
  Sidebar,
  Tooltip,
  type TreeListActionMenuItem,
  type TreeListNavigateEvent,
  type TreeListSection,
} from "@pstdio/ui";
import { PenBox } from "lucide-react";
import { createElement } from "react";
import { useTranslation } from "react-i18next";
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
  onCreateSession: () => void;
  resolveContextMenuItems?: (session: Session) => TreeListActionMenuItem[];
}

const buildSections = (
  sessions: Session[],
  resolveContextMenuItems?: (session: Session) => TreeListActionMenuItem[],
): TreeListSection[] => {
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
      contextMenuItems: resolveContextMenuItems?.(session),
      isNavigable: true,
      navigationIntent: { id: "select-session", payload: session.id },
    })),
  }));
};

export const SessionsSidebar = (props: SessionsSidebarProps) => {
  const { sessions, selectedSessionId, onSelectSession, onCreateSession, resolveContextMenuItems } = props;
  const { t } = useTranslation("projects");

  const sections = buildSections(sessions, resolveContextMenuItems);

  const handleNavigate = (event: TreeListNavigateEvent) => {
    const intent = event.intent;
    if (!intent) return;

    if (intent.id === "select-session") {
      onSelectSession(intent.payload as string);
    }
  };

  const header = (
    <HStack justify="space-between" flex="1">
      <BackToDashboard />
      <Tooltip content={t("sessions.newSession")}>
        <IconButton size="xs" variant="ghost" aria-label={t("sessions.newSession")} onClick={onCreateSession}>
          <PenBox size={16} />
        </IconButton>
      </Tooltip>
    </HStack>
  );

  return (
    <Sidebar
      storageKey={SESSIONS_SIDEBAR_STORAGE_KEY}
      sections={sections}
      activeNodeId={selectedSessionId}
      header={header}
      onNavigate={handleNavigate}
      closable={false}
      width="18rem"
      emptyLabel="No sessions yet"
    />
  );
};

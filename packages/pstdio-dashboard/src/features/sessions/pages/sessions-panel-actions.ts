import { Archive, Square } from "lucide-react";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import type { SessionStatus } from "../types";

const STOPPABLE_SESSION_STATUSES = new Set<SessionStatus>(["in_progress", "awaiting_input"]);

interface BuildSessionOverflowActionsInput {
  selectedSessionId: string | null;
  selectedSessionStatus: SessionStatus | null;
  isSelectedSessionArchived: boolean | null;
  labels: {
    stopSession: string;
    archiveSession: string;
  };
  onStopSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
}

export const canStopSession = (status: SessionStatus) => STOPPABLE_SESSION_STATUSES.has(status);

export const buildSessionOverflowActions = (input: BuildSessionOverflowActionsInput): HeaderActionItem[] => {
  const {
    selectedSessionId,
    selectedSessionStatus,
    isSelectedSessionArchived,
    labels,
    onStopSession,
    onArchiveSession,
  } = input;

  if (!selectedSessionId) {
    return [];
  }

  const actions: HeaderActionItem[] = [];

  if (isSelectedSessionArchived === false && selectedSessionStatus && canStopSession(selectedSessionStatus)) {
    actions.push({
      key: "stop-session",
      label: labels.stopSession,
      kind: "default",
      icon: Square,
      onClick: () => onStopSession(selectedSessionId),
    });
  }

  actions.push({
    key: "archive-session",
    label: labels.archiveSession,
    kind: "default",
    icon: Archive,
    onClick: () => onArchiveSession(selectedSessionId),
  });

  return actions;
};

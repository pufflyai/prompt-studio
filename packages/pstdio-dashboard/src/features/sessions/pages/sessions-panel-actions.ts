import { Archive, Square } from "lucide-react";
import type { HeaderActionItem } from "../../plugin-actions/components/header-action-groups";
import type { SessionStatus } from "../types";
import { canStopSession } from "../utils/can-stop-session";

type BuildSessionOverflowActionsInput = {
  selectedSessionId: string | null;
  selectedSessionStatus: SessionStatus | null;
  isStopPending: boolean;
  hasRequestedStop: boolean;
  t: (key: string) => string;
  onStopSession: () => void;
  onArchiveSession: () => void;
};

export const buildSessionOverflowActions = (input: BuildSessionOverflowActionsInput): HeaderActionItem[] => {
  const {
    selectedSessionId,
    selectedSessionStatus,
    isStopPending,
    hasRequestedStop,
    t,
    onStopSession,
    onArchiveSession,
  } = input;

  if (!selectedSessionId) {
    return [];
  }

  const actions: HeaderActionItem[] = [];

  if (canStopSession(selectedSessionStatus)) {
    actions.push({
      key: "stop-session",
      label: t("sessions.stopSession"),
      kind: "default",
      icon: Square,
      isDisabled: isStopPending || hasRequestedStop,
      onClick: () => {
        if (isStopPending || hasRequestedStop) {
          return;
        }
        onStopSession();
      },
    });
  }

  actions.push({
    key: "archive-session",
    label: t("sessions.archiveSession"),
    kind: "default",
    icon: Archive,
    onClick: onArchiveSession,
  });

  return actions;
};

import { toaster } from "@pstdio/ui";
import { Archive, Copy } from "lucide-react";
import type { HeaderActionItem } from "@/shared/extensions/components/header-actions";

interface BuildSessionOverflowActionsInput {
  sessionId: string;
  agentSessionId?: string | null;
  onArchive: () => void;
  t: (key: string) => string;
}

export const buildSessionOverflowActions = (input: BuildSessionOverflowActionsInput): HeaderActionItem[] => {
  const { sessionId, agentSessionId = null, onArchive, t } = input;

  return [
    ...(agentSessionId
      ? [
          {
            key: "copy-agent-session-id",
            label: t("sessions.copyAgentSessionId"),
            kind: "default" as const,
            icon: Copy,
            onClick: async () => {
              await navigator.clipboard.writeText(agentSessionId);
              toaster.create({
                type: "success",
                title: t("sessions.copyAgentSessionId"),
                description: agentSessionId,
              });
            },
          },
        ]
      : []),
    {
      key: `archive-session:${sessionId}`,
      label: t("sessions.archiveSession"),
      kind: "default",
      icon: Archive,
      onClick: onArchive,
    },
  ];
};

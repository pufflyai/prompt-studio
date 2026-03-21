import { Icon, IconButton, Menu } from "@chakra-ui/react";
import { MenuItem, toaster } from "@pstdio/ui";
import { Archive, Copy, Download, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SessionActionMenuProps {
  agentSessionId: string | null;
  onDownloadSession: () => void;
  onArchiveSession: () => void;
}

export const SessionActionMenu = (props: SessionActionMenuProps) => {
  const { t } = useTranslation("projects");
  const { agentSessionId, onDownloadSession, onArchiveSession } = props;

  const handleCopyAgentSessionId = async () => {
    if (!agentSessionId) return;
    await navigator.clipboard.writeText(agentSessionId);
    toaster.create({ type: "success", title: t("sessions.copyAgentSessionId"), description: agentSessionId });
  };

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label={t("sessions.sessionActions")}>
          <Icon as={MoreHorizontal} boxSize="16px" />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" bg="bg">
          <MenuItem primaryLabel={t("sessions.downloadSessionJson")} leftIcon={Download} onClick={onDownloadSession} />
          {agentSessionId ? (
            <MenuItem
              primaryLabel={t("sessions.copyAgentSessionId")}
              leftIcon={Copy}
              onClick={() => void handleCopyAgentSessionId()}
            />
          ) : null}
          <MenuItem primaryLabel={t("sessions.archiveSession")} leftIcon={Archive} onClick={onArchiveSession} />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

import { Icon, IconButton, Menu } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { Archive, Download, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SessionActionMenuProps {
  onDownloadSession: () => void;
  onArchiveSession: () => void;
}

export const SessionActionMenu = (props: SessionActionMenuProps) => {
  const { t } = useTranslation("projects");
  const { onDownloadSession, onArchiveSession } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label={t("sessions.sessionActions")}>
          <Icon as={MoreHorizontal} boxSize="16px" />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" bg="background.primary">
          <MenuItem primaryLabel={t("sessions.downloadSessionJson")} leftIcon={Download} onClick={onDownloadSession} />
          <MenuItem primaryLabel={t("sessions.archiveSession")} leftIcon={Archive} onClick={onArchiveSession} />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

import { Icon, IconButton, Menu } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { Archive, Download, MoreHorizontal } from "lucide-react";

interface SessionActionMenuProps {
  onDownloadSession: () => void;
  onArchiveSession: () => void;
}

export const SessionActionMenu = (props: SessionActionMenuProps) => {
  const { onDownloadSession, onArchiveSession } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label="Session actions">
          <Icon as={MoreHorizontal} boxSize="16px" />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" bg="background.primary">
          <MenuItem primaryLabel="Download session JSON" leftIcon={Download} onClick={onDownloadSession} />
          <MenuItem primaryLabel="Archive session" leftIcon={Archive} onClick={onArchiveSession} />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

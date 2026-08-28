import { Dialog } from "@chakra-ui/react";
import { NotificationCenter, type NotificationCenterItem } from "@pstdio/ui";

export const INITIAL_NOTIFICATIONS: NotificationCenterItem[] = [
  {
    id: "release-0-24",
    title: "pstdio 0.24.0 released",
    body: "Workbench terminal tabs, extension control panels, and a React terminal surface.",
    priority: "normal",
    status: "open",
    sourceLabel: "release",
    timeLabel: "Jul 9",
    actions: [{ id: "view-changelog", label: "View changelog", primary: true }],
  },
  {
    id: "welcome",
    title: "Welcome to Prompt Studio",
    body: "Press ⌘K anywhere to search or run a command.",
    priority: "low",
    status: "read",
    sourceLabel: "workbench",
  },
];

interface NotificationsModalProps {
  open: boolean;
  items: NotificationCenterItem[];
  onClose: () => void;
  onDismiss: (item: NotificationCenterItem) => void;
  onOpenChangelog: () => void;
}

export const NotificationsModal = (props: NotificationsModalProps) => {
  const { open, items, onClose, onDismiss, onOpenChangelog } = props;

  const handleRunAction = (item: NotificationCenterItem, action: { id: string }) => {
    if (item.id === "release-0-24" && action.id === "view-changelog") {
      onClose();
      onOpenChangelog();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner alignItems="center" justifyContent="center" p="md">
        <Dialog.Content maxW="44rem" w="full" p="0" overflow="hidden" borderWidth="1px" borderColor="border.subtle">
          <NotificationCenter
            items={items}
            emptyLabel="You're all caught up."
            onRunAction={handleRunAction}
            onDismiss={onDismiss}
            onEscape={onClose}
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

import { Box, Dialog, Input, Stack, Text } from "@chakra-ui/react";
import * as React from "react";
import { NotificationRow } from "./notification-row";
import { filterNotifications } from "./notification-search";
import type { NotificationActionItem, NotificationItem } from "./notification-types";

export interface NotificationModalProps {
  open: boolean;
  items: NotificationItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  onClose: () => void;
  onInvokeAction: (item: NotificationItem, action: NotificationActionItem) => void;
}

const DEFAULT_EMPTY_TITLE = "No pending actions.";
const DEFAULT_EMPTY_DESCRIPTION = "Agents can keep working; anything that needs your attention will show up here.";

const usePersistedActive = (items: NotificationItem[]) => {
  const [activeId, setActiveId] = React.useState<string | null>(items[0]?.id ?? null);

  React.useEffect(() => {
    if (items.length === 0) {
      setActiveId(null);
      return;
    }
    if (!items.some((it) => it.id === activeId)) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

  return { activeId, setActiveId };
};

export const NotificationModal = (props: NotificationModalProps) => {
  const { open, items, emptyTitle, emptyDescription, onClose, onInvokeAction } = props;
  const [query, setQuery] = React.useState("");
  const filtered = filterNotifications(items, query);
  const { activeId, setActiveId } = usePersistedActive(filtered);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const moveActive = (delta: number) => {
    if (filtered.length === 0) return;
    const currentIndex = filtered.findIndex((it) => it.id === activeId);
    const next = Math.max(0, Math.min(filtered.length - 1, (currentIndex < 0 ? 0 : currentIndex) + delta));
    setActiveId(filtered[next].id);
  };

  const invokePrimary = () => {
    const active = filtered.find((it) => it.id === activeId);
    if (!active) return;
    const primary = active.actions.find((a) => a.primary) ?? active.actions[0];
    if (primary) onInvokeAction(active, primary);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      invokePrimary();
    }
  };

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(d) => !d.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          maxWidth="640px"
          maxHeight="70vh"
          display="flex"
          flexDirection="column"
          onKeyDown={handleKeyDown}
        >
          <Box px="3" py="2" borderBottom="1px solid" borderColor="border">
            <Input
              ref={inputRef}
              placeholder="Search notifications..."
              variant="flushed"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              data-testid="notification-modal-search"
            />
          </Box>
          <Box overflow="auto" flex="1" py="2">
            {filtered.length === 0 ? (
              <Stack textAlign="center" px="6" py="10" gap="2">
                <Text fontSize="sm" fontWeight="medium">
                  {emptyTitle ?? DEFAULT_EMPTY_TITLE}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {emptyDescription ?? DEFAULT_EMPTY_DESCRIPTION}
                </Text>
              </Stack>
            ) : (
              <Stack gap="1" px="2">
                {filtered.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    active={item.id === activeId}
                    onInvokeAction={(action) => onInvokeAction(item, action)}
                  />
                ))}
              </Stack>
            )}
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

import { CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { PlanRow } from "../contracts";
import type { RequestHandlers } from "./request-form";
import { RequestsPanel } from "./requests-panel";

interface TicketRequestsDialogProps extends RequestHandlers {
  rows: PlanRow[];
  title: string;
  open: boolean;
  pendingOnly: boolean;
  trigger: HTMLElement | null;
  fallback?: HTMLElement | null;
  onClose: () => void;
}

export function TicketRequestsDialog(props: TicketRequestsDialogProps) {
  const { rows, title, open, pendingOnly, trigger, fallback, onClose, ...handlers } = props;
  const row = {
    requests: rows.flatMap((row) =>
      row.requests.map((request) => ({ ...request, ticketLabel: `${row.shorthand} · ${row.title}` })),
    ),
    requestErrors: rows.flatMap((row) => row.requestErrors),
  };
  return (
    <Dialog.Root
      open={open}
      unmountOnExit={false}
      onOpenChange={({ open }) => !open && onClose()}
      size="md"
      scrollBehavior="inside"
      finalFocusEl={() => {
        if (trigger?.isConnected) return trigger;
        return fallback?.isConnected ? fallback : null;
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <ScrollArea>
                <RequestsPanel row={row} heading={false} pendingOnly={pendingOnly} {...handlers} />
              </ScrollArea>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

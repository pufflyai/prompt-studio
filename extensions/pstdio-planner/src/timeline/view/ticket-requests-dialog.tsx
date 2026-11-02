import { CloseButton, Dialog, Portal } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import type { PlanRow } from "../contracts";
import type { RequestHandlers } from "./request-form";
import { RequestsPanel } from "./requests-panel";

interface TicketRequestsDialogProps extends RequestHandlers {
  row: PlanRow;
  trigger: HTMLElement | null;
  onClose: () => void;
}

export function TicketRequestsDialog(props: TicketRequestsDialogProps) {
  const { row, trigger, onClose, ...handlers } = props;
  const [pendingOnly] = useState(() => row.requests.some(({ state }) => state === "open"));
  return (
    <Dialog.Root
      open
      onOpenChange={({ open }) => !open && onClose()}
      size="md"
      scrollBehavior="inside"
      finalFocusEl={() => trigger}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {row.shorthand} · {row.title}
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <ScrollArea>
                <RequestsPanel key={row.id} row={row} heading={false} pendingOnly={pendingOnly} {...handlers} />
              </ScrollArea>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

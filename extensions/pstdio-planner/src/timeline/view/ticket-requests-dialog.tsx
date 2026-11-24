import { CloseButton, Dialog, Portal, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { type ReactNode, useEffect } from "react";
import type { TimelineRequestScope } from "../commands/request-page";
import type { PlanRow } from "../contracts";
import type { RequestHandlers } from "./request-form";
import { RequestWindowControls, useRequestWindow } from "./request-window";
import { RequestsPanel } from "./requests-panel";
import type { PlanClient } from "./use-plan";

interface RequestsDialogProps extends RequestHandlers {
  row: Pick<PlanRow, "requests" | "requestErrors">;
  title: string;
  open: boolean;
  pendingOnly: boolean;
  trigger: HTMLElement | null;
  fallback?: HTMLElement | null;
  onClose: () => void;
  footer?: ReactNode;
  total?: number;
  loading?: boolean;
}

export function TicketRequestsDialog(
  props: Omit<RequestsDialogProps, "row"> & {
    rows: PlanRow[];
    source?: { client: PlanClient; scope: TimelineRequestScope };
  },
) {
  const { rows, source, ...dialog } = props;
  if (source) return dialog.open ? <PagedRequestsDialog {...dialog} source={source} /> : null;
  const row = {
    requests: rows.flatMap((row) =>
      row.requests.map((request) => ({ ...request, ticketLabel: `${row.shorthand} · ${row.title}` })),
    ),
    requestErrors: rows.flatMap((row) => row.requestErrors),
  };
  return <RequestsDialog {...dialog} row={row} />;
}

function PagedRequestsDialog(
  props: Omit<RequestsDialogProps, "row"> & { source: { client: PlanClient; scope: TimelineRequestScope } },
) {
  const { source, ...dialog } = props;
  const page = useRequestWindow(source.client, { ...source.scope, pendingOnly: props.pendingOnly });
  const result = page.result ?? page.previous;
  return (
    <RequestsDialog
      {...dialog}
      total={result?.total}
      loading={page.loading}
      row={{ requests: result?.requests ?? [], requestErrors: result?.errors ?? [] }}
      footer={<RequestWindowControls {...page} />}
    />
  );
}

export function RequestsDialog(props: RequestsDialogProps) {
  const { row, title, open, pendingOnly, trigger, fallback, onClose, footer, total, loading, ...handlers } = props;
  const empty =
    !loading &&
    (total === undefined
      ? !row.requestErrors.length && !row.requests.some(({ state }) => !pendingOnly || state === "open")
      : total === 0);
  useEffect(() => {
    if (open && empty) onClose();
  }, [open, empty, onClose]);
  return (
    <Dialog.Root
      open={open && !empty}
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
                {loading ? (
                  <Text>Loading requests…</Text>
                ) : (
                  <RequestsPanel row={row} heading={false} pendingOnly={pendingOnly} {...handlers} />
                )}
                {footer}
              </ScrollArea>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

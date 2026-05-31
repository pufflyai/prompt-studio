import { Center, Flex, IconButton, Spinner, Stack } from "@chakra-ui/react";
import type { GuestHost, PropsStore } from "@pstdio/sdk/extensions";
import {
  AlertMessage,
  DataRenderer,
  type DataRendererBoardColumnAction,
  ResizableSplitLayout,
  Tooltip,
} from "@pstdio/ui";
import { Archive, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { CreateTicketDialog } from "./create-ticket-dialog";
import {
  createTicketAttributes,
  createTicketRows,
  resolveTicketBoardColumnConfig,
  type TicketDataRow,
  ticketDefaultSettings,
} from "./ticket-data";
import { TicketDetailPanel } from "./ticket-detail-panel";
import {
  archiveTicket,
  commandIds,
  createTicket,
  notifyInfo,
  readTicketBoard,
  updateTicketStatus,
} from "./ticket-panel-api";
import type { ExtensionViewProps, TicketBoardReadModel } from "./ticket-panel-types";

interface TicketPanelViewProps {
  host: GuestHost;
  propsStore: PropsStore<ExtensionViewProps>;
}

const columnActionMap = {
  archive_all: { label: "Archive all", icon: Archive },
} satisfies Record<string, Omit<DataRendererBoardColumnAction, "id">>;

const emptyBoardModel = {
  statuses: [],
  tickets: [],
} satisfies TicketBoardReadModel;

const useExtensionProps = (propsStore: PropsStore<ExtensionViewProps>) => {
  const [props, setProps] = useState(() => propsStore.get());

  useEffect(() => propsStore.subscribe(setProps), [propsStore]);

  return props;
};

export const TicketPanelView = (props: TicketPanelViewProps) => {
  const { host, propsStore } = props;
  const extensionProps = useExtensionProps(propsStore);
  const [model, setModel] = useState<TicketBoardReadModel>(emptyBoardModel);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const lastCommandId = extensionProps.lastCommand?.commandId;

  const refresh = async () => {
    setError(null);
    const next = await readTicketBoard(host);
    setModel(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void readTicketBoard(host)
      .then((next) => {
        if (!cancelled) setModel(next);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [host]);

  useEffect(() => {
    if (!lastCommandId?.startsWith("pstdio-core-tickets.") || lastCommandId === commandIds.readBoard) return;
    setError(null);
    void readTicketBoard(host)
      .then(setModel)
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [host, lastCommandId]);

  const rows = createTicketRows(model.tickets);
  const attributes = createTicketAttributes(model.statuses);
  const selectedRow = rows.find((row) => row.id === selectedRowId);

  useEffect(() => {
    if (rows.length === 0) {
      if (selectedRowId !== null) setSelectedRowId(null);
      return;
    }
    if (!selectedRowId || !rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(rows[0]?.id ?? null);
    }
  }, [rows, selectedRowId]);

  const runMutation = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateTicketStatus = async (rowId: string, status: string) => {
    const row = rows.find((candidate) => candidate.id === rowId);
    if (!row) return;
    await runMutation(() => updateTicketStatus(host, { id: row.attributes.shorthand, status }));
  };

  const handleArchiveTicketsInStatus = async (status: string) => {
    const tickets = rows.filter((row) => row.attributes.status === status);
    await runMutation(async () => {
      for (const ticket of tickets) {
        await archiveTicket(host, ticket.attributes.shorthand);
      }
      await notifyInfo(host, "Tickets archived", `${tickets.length} ticket(s) moved out of the active board.`);
    });
  };

  const handleCreateTicket = async (input: { content: string; status: string | null }) => {
    await runMutation(async () => {
      await createTicket(host, {
        content: input.content,
        ...(input.status ? { status: input.status } : {}),
      });
      setCreateStatus(null);
    });
  };

  const boardPanel = (
    <Stack h="full" minH="0" minW="0" gap="sm" p="sm" bg="bg" color="fg">
      {error ? (
        <AlertMessage status="error" colorPalette="red" title="Ticket board failed" size="sm">
          {error}
        </AlertMessage>
      ) : null}
      <DataRenderer<TicketDataRow>
        rows={rows}
        storageKey="pstdio-core-tickets.ticket-panel"
        attributes={attributes}
        selectedRowId={selectedRowId}
        emptyTitle="No tickets found"
        emptyDescription="Create a ticket to start the workflow."
        defaultSettings={ticketDefaultSettings}
        toolbarLeading={
          <Tooltip content="Refresh tickets">
            <IconButton
              aria-label="Refresh tickets"
              size="sm"
              variant="ghost"
              loading={busy}
              onClick={() => void runMutation(async () => undefined)}
            >
              <RefreshCw size={16} />
            </IconButton>
          </Tooltip>
        }
        onRowClick={(row) => setSelectedRowId(row.id)}
        onCreateRow={(status) => setCreateStatus(status)}
        onAttributeChange={(rowId, attributeId, value) => {
          if (attributeId !== "status") return;
          void handleUpdateTicketStatus(rowId, String(value));
        }}
        onColumnAction={(status, actionId) => {
          if (actionId !== "archive_all") return;
          void handleArchiveTicketsInStatus(status);
        }}
        getBoardColumnConfig={(status) => {
          const config = resolveTicketBoardColumnConfig(model.statuses, status);
          return {
            color: config.color,
            canCreate: config.canCreate,
            canDragIn: config.canDragIn,
            canDragOut: config.canDragOut,
            actions: config.actionIds.map((actionId) => ({ id: actionId, ...columnActionMap[actionId] })),
          };
        }}
      />
    </Stack>
  );

  const detailPanel = <TicketDetailPanel host={host} ticket={selectedRow} />;

  if (loading) {
    return (
      <Center h="full" minH="0" bg="bg" color="fg.muted">
        <Spinner size="sm" />
      </Center>
    );
  }

  return (
    <Flex h="full" minH="0" minW="0" bg="bg" color="fg" overflow="hidden">
      <ResizableSplitLayout
        flex="1"
        minH="0"
        minW="0"
        resizablePanel={detailPanel}
        contentPanel={boardPanel}
        resizableSide="right"
        defaultSizePx={480}
        minSizePx={320}
        maxSizePx={720}
        contentMinSizePx={420}
        resizeLabel="Resize ticket details"
      />
      <CreateTicketDialog
        open={createStatus !== null}
        status={createStatus}
        submitting={busy}
        onClose={() => setCreateStatus(null)}
        onSubmit={handleCreateTicket}
      />
    </Flex>
  );
};

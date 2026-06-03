import { Center, Spinner } from "@chakra-ui/react";
import { useState } from "react";
import { useTicketHost, useTicketHostProps } from "../hooks/host-context";
import { runCommand, useCommandQuery } from "../hooks/use-command";
import { TicketFileTree } from "./ticket-file-tree";
import { createTicketView } from "./view-shell";

const GET_TICKET = "pstdio-core-tickets.get-ticket";
const CREATE_TICKET_FILE = "pstdio-core-tickets.create-ticket-file";
const DELETE_TICKET_FILE = "pstdio-core-tickets.delete-ticket-file";
const SELECT_TICKET_FILE = "pstdio-core-tickets.select-ticket-file";

const TICKET_BODY_ID = "__ticket__";

interface LoadedTicketFile {
  id: string;
  name: string;
}

interface LoadedTicket {
  id: string;
  files?: LoadedTicketFile[];
}

const TicketFilesView = () => {
  const { host } = useTicketHost();
  const { resource } = useTicketHostProps();
  const ticketId = resource?.id;
  const [selectedId, setSelectedId] = useState(TICKET_BODY_ID);

  const ticketQuery = useCommandQuery<LoadedTicket | null>({
    queryKey: ["ticket-files", ticketId],
    commandId: GET_TICKET,
    params: { id: ticketId },
    enabled: Boolean(ticketId),
  });
  const files = ticketQuery.data?.files ?? [];

  const select = async (fileId: string) => {
    if (!ticketId) return;
    setSelectedId(fileId);
    await runCommand(host, SELECT_TICKET_FILE, {
      ticketId,
      ...(fileId === TICKET_BODY_ID ? {} : { fileId }),
    });
  };

  const handleCreate = async (name: string) => {
    if (!ticketId) return;
    const file = await runCommand<LoadedTicketFile>(host, CREATE_TICKET_FILE, { ticketId, name });
    await ticketQuery.refetch();
    if (file?.id) await select(file.id);
  };

  const handleDelete = async (fileId: string) => {
    if (!ticketId) return;
    await runCommand(host, DELETE_TICKET_FILE, { ticketId, fileId });
    await ticketQuery.refetch();
    if (selectedId === fileId) await select(TICKET_BODY_ID);
  };

  if (!ticketId || ticketQuery.isPending) {
    return (
      <Center h="full" minH="0">
        <Spinner size="sm" />
      </Center>
    );
  }

  return (
    <TicketFileTree
      bodyId={TICKET_BODY_ID}
      files={files}
      selectedId={selectedId}
      onSelect={(id) => void select(id)}
      onCreate={(name) => void handleCreate(name)}
      onDelete={(id) => void handleDelete(id)}
    />
  );
};

export default createTicketView(() => <TicketFilesView />);

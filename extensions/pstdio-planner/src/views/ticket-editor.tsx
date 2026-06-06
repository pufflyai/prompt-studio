import { Box, Center, Editable, Flex, Spinner, Text } from "@chakra-ui/react";
import { installPrismGlobal } from "@pstdio/ui";
import type { MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { useTicketHost, useTicketHostProps } from "../hooks/host-context";
import { runCommand, useCommandQuery } from "../hooks/use-command";
import { useContentAutosave } from "../hooks/use-content-autosave";
import { createTicketView } from "./view-shell";

const GET_TICKET = "pstdio-planner.get-ticket";
const UPDATE_TICKET = "pstdio-planner.update-ticket";
const UPDATE_TICKET_FILE = "pstdio-planner.update-ticket-file";
const SELECT_FILE_COMMAND = ".select-ticket-file";
const CREATE_FILE_COMMAND = ".create-ticket-file";
const DELETE_FILE_COMMAND = ".delete-ticket-file";

// Selecting this edits the ticket body; any other id edits the matching file.
const TICKET_BODY_ID = "__ticket__";
const ID_SEPARATOR = "::";

interface LoadedTicketFile {
  id: string;
  name: string;
  content: string;
}

interface LoadedTicket {
  id: string;
  content: string;
  files?: LoadedTicketFile[];
}

interface ActiveFileHeaderProps {
  file: LoadedTicketFile | null;
  onRename: (name: string) => void;
}

const ActiveFileHeader = (props: ActiveFileHeaderProps) => {
  const { file, onRename } = props;
  if (!file) return null;

  return (
    <Flex align="center" borderBottomWidth="1px" borderColor="border" flexShrink={0} gap="xs" minH="44px" px="sm">
      <Text color="fg.muted" fontSize="xs" fontWeight="medium">
        File
      </Text>
      <Editable.Root
        key={file.id}
        defaultValue={file.name}
        onValueCommit={(details) => {
          const trimmed = details.value.trim();
          if (trimmed && trimmed !== file.name) onRename(trimmed);
        }}
      >
        <Editable.Preview fontSize="sm" fontWeight="medium" px="1" />
        <Editable.Input fontSize="sm" fontWeight="medium" px="1" />
      </Editable.Root>
    </Flex>
  );
};

const TicketEditor = () => {
  const { host } = useTicketHost();
  const { resource, lastCommand } = useTicketHostProps();
  const ticketId = resource?.id;

  const [Editor, setEditor] = useState<ComponentType<MarkdownEditorProps> | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const ticketQuery = useCommandQuery<LoadedTicket | null>({
    queryKey: ["ticket", ticketId],
    commandId: GET_TICKET,
    params: { id: ticketId },
    enabled: Boolean(ticketId),
  });
  const ticket = ticketQuery.data ?? null;
  const files = ticket?.files ?? [];

  // react-query's refetch is stable, but routing it through a ref keeps it out of
  // the selection effect's deps — depending on the query would refetch-on-data and
  // loop.
  const refetch = useRef(ticketQuery.refetch);
  refetch.current = ticketQuery.refetch;

  // The native files tree broadcasts file commands over the command feed. Mirror
  // the resulting selection here and refetch so changes made elsewhere are visible:
  // selecting opens a file, creating opens the new one, and deleting the open file
  // falls back to the ticket body (otherwise the editor keeps saving into a file
  // that no longer exists).
  useEffect(() => {
    if (!ticketId || !lastCommand) return;
    const { commandId, outcome } = lastCommand;
    if (!outcome?.ok) return;
    const value = outcome.value as { ticketId?: string; fileId?: string | null; id?: string } | undefined;
    if (!value || value.ticketId !== ticketId) return;

    if (commandId.endsWith(SELECT_FILE_COMMAND)) setSelectedFileId(value.fileId ?? null);
    else if (commandId.endsWith(CREATE_FILE_COMMAND)) setSelectedFileId(value.id ?? null);
    else if (commandId.endsWith(DELETE_FILE_COMMAND))
      setSelectedFileId((current) => (current === value.fileId ? null : current));
    else return;

    void refetch.current();
  }, [lastCommand, ticketId]);

  const selectedFile = selectedFileId ? (files.find((file) => file.id === selectedFileId) ?? null) : null;
  const activeId = selectedFile ? selectedFile.id : TICKET_BODY_ID;
  const baseContent = selectedFile ? selectedFile.content : (ticket?.content ?? "");
  const key = ticketId ? `${ticketId}${ID_SEPARATOR}${activeId}` : "";

  // Freeze the editor seed per open file so a re-render never resets the autosave
  // engine and clobbers in-flight keystrokes (see ticket-editor history).
  const savedContent = useRef<Record<string, string>>({});
  const seededKey = useRef<string | null>(null);
  const seed = useRef("");
  if (ticket && seededKey.current !== key) {
    seededKey.current = key;
    seed.current = key in savedContent.current ? savedContent.current[key] : baseContent;
  }
  const content = seed.current;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await installPrismGlobal();
      const mod = await import("@pstdio/ui/rich-text");
      if (!cancelled) setEditor(() => mod.MarkdownEditor);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const contentAutosave = useContentAutosave({
    id: key,
    initialContent: content,
    save: async (id, value) => {
      savedContent.current[id] = value;
      const separator = id.indexOf(ID_SEPARATOR);
      if (separator < 0) return;
      const ownerId = id.slice(0, separator);
      const target = id.slice(separator + ID_SEPARATOR.length);
      if (target === TICKET_BODY_ID) {
        await runCommand(host, UPDATE_TICKET, { id: ownerId, content: value });
        return;
      }
      await runCommand(host, UPDATE_TICKET_FILE, { ticketId: ownerId, fileId: target, content: value });
    },
  });

  const renameSelectedFile = (name: string) => {
    if (!ticketId || !selectedFile) return;
    void runCommand(host, UPDATE_TICKET_FILE, { ticketId, fileId: selectedFile.id, name }).then(() =>
      refetch.current(),
    );
  };

  if (!ticketId) {
    return (
      <Center h="full" minH="0" p="lg">
        <Text color="fg.muted">No ticket selected.</Text>
      </Center>
    );
  }

  if (!ticket || !Editor) {
    return (
      <Center h="full" minH="0">
        <Spinner />
      </Center>
    );
  }

  return (
    <Flex direction="column" h="full" minH="0" overflow="hidden">
      <ActiveFileHeader file={selectedFile} onRename={renameSelectedFile} />
      <Box flex="1" minH="0" overflowY="auto">
        <Editor
          key={contentAutosave.editorKey}
          defaultState={content}
          isEditable
          placeholder={activeId === TICKET_BODY_ID ? "Write the ticket description…" : "Write…"}
          onChange={contentAutosave.handleChange}
        />
      </Box>
    </Flex>
  );
};

export default createTicketView(() => <TicketEditor />);

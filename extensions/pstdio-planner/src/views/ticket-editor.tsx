import { Box, Center, Flex, Spinner, Text } from "@chakra-ui/react";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { installPrismGlobal } from "@pstdio/ui";
import type { MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { type HostCommandEvent, useTicketHost, useTicketHostProps } from "../hooks/host-context";
import { runCommand, useCommandQuery } from "../hooks/use-command";
import { useContentAutosave } from "../hooks/use-content-autosave";
import { ImageAttachmentPreview } from "./image-attachment-preview";
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

interface LoadedAttachment {
  id: string;
  name: string;
}

interface LoadedTicket {
  id: string;
  content: string;
  files?: LoadedTicketFile[];
  attachments?: LoadedAttachment[];
}

// The files tree tags each selection with its kind so the editor can pick the body,
// an editable file, or a read-only image preview explicitly instead of inferring it
// from whether the id happens to match a file. The owning ticketId lets a stale
// selection from a previously open ticket be ignored without a reset effect.
type SelectionKind = "ticket" | "file" | "attachment";
interface Selection {
  ticketId: string;
  fileId: string | null;
  kind: SelectionKind;
}

interface SelectionCommand {
  commandId: string;
  ticketId: string;
  value: { fileId?: string | null; id?: string; kind?: SelectionKind };
  current: Selection | null;
}

// Maps a broadcast file command to the next selection. Deleting the open file falls
// back to the ticket body so the editor never keeps saving into a removed file.
const nextSelectionFor = ({ commandId, ticketId, value, current }: SelectionCommand) => {
  if (commandId.endsWith(SELECT_FILE_COMMAND))
    return { ticketId, fileId: value.fileId ?? null, kind: value.kind ?? "ticket" };
  if (commandId.endsWith(CREATE_FILE_COMMAND)) return { ticketId, fileId: value.id ?? null, kind: "file" as const };
  return current?.fileId === value.fileId ? null : current;
};

// Tracks the files-tree selection (body, editable file, or image attachment) for the
// open ticket, refetching when it changes. A selection from a previously open ticket
// is ignored so it can never silently edit the current one.
const useFileSelection = (
  ticketId: string | undefined,
  lastCommand: HostCommandEvent | undefined,
  doRefetch: () => void,
) => {
  const [selection, setSelection] = useState<Selection | null>(null);
  // The refetch stays in a ref so it never enters the effect deps and re-runs on data.
  const refetch = useRef(doRefetch);
  refetch.current = doRefetch;

  useEffect(() => {
    if (!ticketId || !lastCommand) return;
    const { commandId, outcome } = lastCommand;
    if (!outcome?.ok) return;
    const value = outcome.value as (SelectionCommand["value"] & { ticketId?: string }) | undefined;
    if (!value || value.ticketId !== ticketId) return;

    const handled =
      commandId.endsWith(SELECT_FILE_COMMAND) ||
      commandId.endsWith(CREATE_FILE_COMMAND) ||
      commandId.endsWith(DELETE_FILE_COMMAND);
    if (!handled) return;

    setSelection((current) => nextSelectionFor({ commandId, ticketId, value, current }));
    void refetch.current();
  }, [lastCommand, ticketId]);

  return selection?.ticketId === ticketId ? selection : null;
};

// Resolves the active selection to the editable file or read-only image attachment it
// points at; the body (or any unmatched selection) yields neither.
const resolveSelectedNode = (
  selection: Selection | null,
  files: LoadedTicketFile[],
  attachments: LoadedAttachment[],
) => {
  if (selection?.kind === "file" && selection.fileId)
    return { file: files.find((entry) => entry.id === selection.fileId) ?? null, attachment: null };
  if (selection?.kind === "attachment" && selection.fileId)
    return { file: null, attachment: attachments.find((entry) => entry.id === selection.fileId) ?? null };
  return { file: null, attachment: null };
};

// Autosave keys are `${ticketId}::${target}`; the target routes the save to the
// ticket body or the matching file.
const saveSelectedContent = async (
  host: GuestHost,
  savedContent: Record<string, string>,
  id: string,
  value: string,
) => {
  savedContent[id] = value;
  const separator = id.indexOf(ID_SEPARATOR);
  if (separator < 0) return;
  const ownerId = id.slice(0, separator);
  const target = id.slice(separator + ID_SEPARATOR.length);
  if (target === TICKET_BODY_ID) {
    await runCommand(host, UPDATE_TICKET, { id: ownerId, content: value });
    return;
  }
  await runCommand(host, UPDATE_TICKET_FILE, { ticketId: ownerId, fileId: target, content: value });
};

const TicketEditor = () => {
  const { host } = useTicketHost();
  const { resource, lastCommand } = useTicketHostProps();
  const ticketId = resource?.id;

  const [Editor, setEditor] = useState<ComponentType<MarkdownEditorProps> | null>(null);

  const ticketQuery = useCommandQuery<LoadedTicket | null>({
    queryKey: ["ticket", ticketId],
    commandId: GET_TICKET,
    params: { id: ticketId },
    enabled: Boolean(ticketId),
  });
  const ticket = ticketQuery.data ?? null;
  const files = ticket?.files ?? [];
  const attachments = ticket?.attachments ?? [];

  // The native files tree broadcasts file commands over the command feed; the hook
  // mirrors the resulting selection and refetches so changes elsewhere are visible.
  // Image previews are read-only, so an attachment selection skips the editor and
  // autosave entirely.
  const selection = useFileSelection(ticketId, lastCommand, ticketQuery.refetch);
  const { file: selectedFile, attachment: selectedAttachment } = resolveSelectedNode(selection, files, attachments);

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
    save: (id, value) => saveSelectedContent(host, savedContent.current, id, value),
  });

  if (!ticketId) {
    return (
      <Center h="full" minH="0" p="lg">
        <Text color="fg.muted">No ticket selected.</Text>
      </Center>
    );
  }

  if (!ticket) {
    return (
      <Center h="full" minH="0">
        <Spinner />
      </Center>
    );
  }

  if (selectedAttachment) {
    return (
      <ImageAttachmentPreview
        ticketId={ticket.id}
        attachmentId={selectedAttachment.id}
        name={selectedAttachment.name}
      />
    );
  }

  if (!Editor) {
    return (
      <Center h="full" minH="0">
        <Spinner />
      </Center>
    );
  }

  return (
    <Flex direction="column" h="full" minH="0" overflow="hidden">
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

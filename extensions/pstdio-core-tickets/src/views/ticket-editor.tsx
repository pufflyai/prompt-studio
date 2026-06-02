import { Box, Center, HStack, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import { installPrismGlobal } from "@pstdio/ui";
import type { MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ComponentType, useCallback, useEffect, useState } from "react";
import { useTicketHost, useTicketHostProps } from "./host-context";
import { TicketPropertiesPanel } from "./ticket-properties";
import { useContentAutosave } from "./use-content-autosave";
import { createTicketView } from "./view-shell";

const GET_TICKET = "pstdio-core-tickets.get-ticket";
const UPDATE_TICKET = "pstdio-core-tickets.update-ticket";

interface LoadedTicket {
  id: string;
  shorthand: string;
  title: string;
  content: string;
  statusId: string | null;
  tagIds?: string[];
  parentId?: string | null;
  dependsOn?: string | null;
  archived?: boolean;
  updatedAt: string;
}

const readTicket = (response: unknown) =>
  (response as { outcome?: { value?: LoadedTicket | null } }).outcome?.value ?? null;

const TicketEditor = () => {
  const { host } = useTicketHost();
  const { resource } = useTicketHostProps();
  const ticketId = resource?.id;

  const [ticket, setTicket] = useState<LoadedTicket | null>(null);
  const [loadedId, setLoadedId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [Editor, setEditor] = useState<ComponentType<MarkdownEditorProps> | null>(null);

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

  const fetchTicket = useCallback(
    async (id: string) => {
      const response = await host.call("commands.execute", { commandId: GET_TICKET, params: { id } });
      return readTicket(response);
    },
    [host],
  );

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    void (async () => {
      const loaded = await fetchTicket(ticketId);
      if (cancelled) return;
      setTicket(loaded);
      setTitle(loaded?.title ?? "");
      setLoadedId(ticketId);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchTicket, ticketId]);

  const updateField = (params: Record<string, unknown>) =>
    host.call("commands.execute", { commandId: UPDATE_TICKET, params });

  const contentAutosave = useContentAutosave({
    id: ticketId ?? "",
    initialContent: ticket?.content ?? "",
    save: async (id, content) => void (await updateField({ id, content })),
  });

  const titleAutosave = useContentAutosave({
    id: ticketId ?? "",
    initialContent: ticket?.title ?? "",
    save: async (id, value) => void (await updateField({ id, title: value })),
  });

  // Property edits (status/tags) re-read the ticket; flush content first so a
  // pending body edit is persisted before the refetch resets the editor.
  const reloadProperties = useCallback(() => {
    if (!ticketId) return;
    contentAutosave.flush();
    void fetchTicket(ticketId).then((next) => next && setTicket((current) => ({ ...current, ...next })));
  }, [contentAutosave, fetchTicket, ticketId]);

  if (!ticketId) {
    return (
      <Center h="full" minH="0" p="lg">
        <Text color="fg.muted">No ticket selected.</Text>
      </Center>
    );
  }

  if (loadedId !== ticketId || !ticket || !Editor) {
    return (
      <Center h="full" minH="0">
        <Spinner />
      </Center>
    );
  }

  return (
    <HStack h="full" minH="0" align="stretch" gap="0">
      <Stack flex="1" minW="0" minH="0" gap="sm" overflow="auto" p="lg">
        <Input
          value={title}
          placeholder="Untitled ticket"
          variant="flushed"
          fontSize="xl"
          fontWeight="semibold"
          onChange={(event) => {
            setTitle(event.target.value);
            titleAutosave.handleChange(event.target.value);
          }}
        />
        <Box flex="1" minH="0">
          <Editor
            key={contentAutosave.editorKey}
            defaultState={ticket.content}
            isEditable
            placeholder="Write the ticket description…"
            onChange={contentAutosave.handleChange}
          />
        </Box>
      </Stack>
      <TicketPropertiesPanel host={host} ticket={ticket} onChanged={reloadProperties} />
    </HStack>
  );
};

export default createTicketView(() => <TicketEditor />);

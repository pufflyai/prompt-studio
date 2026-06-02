import { Box, Button, Center, Flex, Spinner, Stack, Text, Wrap } from "@chakra-ui/react";
import { type CommandResponse, unwrapCommandOutcome } from "@pstdio/sdk/extensions";
import { installPrismGlobal } from "@pstdio/ui";
import type { MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ComponentType, useEffect, useState } from "react";
import { useTicketHost, useTicketHostProps } from "./host-context";
import { nextTagSelection } from "./tag-selection";
import { createTicketView } from "./view-shell";

const CREATE_TICKET = "pstdio-core-tickets.create-ticket";
const ATTACH_FILE = "pstdio-core-tickets.attach-file";
const READ_STATUSES = "pstdio-core-tickets.ticketStatus.read";
const READ_TAGS = "pstdio-core-tickets.ticketTag.read";

interface StatusDef {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
}
interface TagOptionDef {
  id: string;
  name: string;
  color: string;
}
interface TagDef {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  options: TagOptionDef[];
}

interface CreatedTicket {
  id: string;
}

// The board card shows the title, so derive a concise heading from the first
// non-empty line of the body (matching the old dashboard's content-as-title flow).
const deriveTitle = (content: string) => {
  const firstLine = content
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find((line) => line.length > 0);
  return firstLine || "Untitled";
};

const CreateTicketModal = () => {
  const { files, host } = useTicketHost();
  const { resource } = useTicketHostProps();
  const targetStatusId = resource?.id;

  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [tags, setTags] = useState<TagDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [Editor, setEditor] = useState<ComponentType<MarkdownEditorProps> | null>(null);

  const [content, setContent] = useState("");
  const [statusId, setStatusId] = useState<string | undefined>(targetStatusId);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [statusRes, tagRes] = await Promise.all([
        host.call<CommandResponse<{ statuses?: StatusDef[] }>>("commands.execute", { commandId: READ_STATUSES }),
        host.call<CommandResponse<{ tags?: TagDef[] }>>("commands.execute", { commandId: READ_TAGS }),
      ]);
      if (cancelled) return;
      const nextStatuses = unwrapCommandOutcome(statusRes).statuses ?? [];
      setStatuses(nextStatuses);
      setTags(unwrapCommandOutcome(tagRes).tags ?? []);
      setStatusId((current) => current ?? nextStatuses.find((status) => status.isDefault)?.id ?? nextStatuses[0]?.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const toggleTagOption = (tag: TagDef, optionId: string) => {
    setTagIds((current) => {
      return nextTagSelection({ current, optionId, tag });
    });
  };

  const pickFiles = async () => {
    const picked = await files.pick({ multiple: true });
    setSelectedFiles((current) => [...current, ...picked]);
  };

  const uploadAttachments = async (ticketId: string) => {
    for (const file of selectedFiles) {
      const ref = await files.upload({
        name: file.name,
        data: await file.arrayBuffer(),
        mimeType: file.type || undefined,
        scope: { type: "resource", id: ticketId },
      });
      const response = await host.call<CommandResponse<unknown>>("commands.execute", {
        commandId: ATTACH_FILE,
        params: { ticketId, ref },
      });
      unwrapCommandOutcome(response);
    }
  };

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    // On success the dashboard host closes this overlay and refreshes the board.
    try {
      const response = await host.call<CommandResponse<CreatedTicket>>("commands.execute", {
        commandId: CREATE_TICKET,
        params: { title: deriveTitle(trimmed), content: trimmed, statusId, tagIds },
      });
      const created = unwrapCommandOutcome(response);
      await uploadAttachments(created.id);
    } catch (error) {
      setSubmitting(false);
      await host
        .call("notification.show", {
          level: "error",
          title: "Could not create ticket",
          message: error instanceof Error ? error.message : String(error),
        })
        .catch(() => undefined);
    }
  };

  if (loading || !Editor) {
    return (
      <Center h="320px" w="full">
        <Spinner />
      </Center>
    );
  }

  const selected = new Set(tagIds);

  return (
    <Stack gap="md" p="lg" w="full" maxW="640px">
      <Text textStyle="label/M/medium">New ticket</Text>

      <Box minH="180px" borderWidth="1px" borderColor="border" borderRadius="md" p="sm">
        <Editor defaultState="" isEditable={!submitting} placeholder="Describe the ticket…" onChange={setContent} />
      </Box>

      <Wrap gap="2xs">
        {statuses.map((status) => (
          <Button
            key={status.id}
            size="2xs"
            variant={statusId === status.id ? "solid" : "outline"}
            colorPalette={status.color}
            disabled={submitting}
            onClick={() => setStatusId(status.id)}
          >
            {status.name}
          </Button>
        ))}
      </Wrap>

      {tags.map((tag) => (
        <Stack key={tag.id} gap="2xs">
          <Text textStyle="label/XS/medium" color="fg.muted" textTransform="uppercase">
            {tag.name}
          </Text>
          <Wrap gap="2xs">
            {tag.options.map((option) => (
              <Button
                key={option.id}
                size="2xs"
                variant={selected.has(option.id) ? "solid" : "outline"}
                colorPalette={option.color}
                disabled={submitting}
                onClick={() => toggleTagOption(tag, option.id)}
              >
                {option.name}
              </Button>
            ))}
          </Wrap>
        </Stack>
      ))}

      {selectedFiles.length > 0 ? (
        <Wrap gap="2xs">
          {selectedFiles.map((file, index) => (
            <Button
              key={`${file.name}-${index.toString()}`}
              size="2xs"
              variant="outline"
              disabled={submitting}
              onClick={() => setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              {file.name}
            </Button>
          ))}
        </Wrap>
      ) : null}

      <Flex justify="flex-end">
        <Button size="sm" variant="outline" disabled={submitting} onClick={() => void pickFiles()}>
          Attach files
        </Button>
        <Button size="sm" variant="solid" loading={submitting} disabled={!content.trim()} onClick={() => void submit()}>
          Create ticket
        </Button>
      </Flex>
    </Stack>
  );
};

export default createTicketView(() => <CreateTicketModal />);

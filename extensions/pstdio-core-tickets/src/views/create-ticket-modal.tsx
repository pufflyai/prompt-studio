import { Box, Button, Center, Flex, Spinner, Stack, Text, Wrap } from "@chakra-ui/react";
import { installPrismGlobal } from "@pstdio/ui";
import type { MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { type ComponentType, useEffect, useState } from "react";
import { useTicketHost, useTicketHostProps } from "./host-context";
import { createTicketView } from "./view-shell";

const CREATE_TICKET = "pstdio-core-tickets.create-ticket";
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

const value = (response: unknown) => (response as { outcome?: { value?: unknown } }).outcome?.value;

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
  const { host } = useTicketHost();
  const { resource } = useTicketHostProps();
  const targetStatusId = resource?.id;

  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [tags, setTags] = useState<TagDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [Editor, setEditor] = useState<ComponentType<MarkdownEditorProps> | null>(null);

  const [content, setContent] = useState("");
  const [statusId, setStatusId] = useState<string | undefined>(targetStatusId);
  const [tagIds, setTagIds] = useState<string[]>([]);
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
        host.call("commands.execute", { commandId: READ_STATUSES }),
        host.call("commands.execute", { commandId: READ_TAGS }),
      ]);
      if (cancelled) return;
      const nextStatuses = ((value(statusRes) as { statuses?: StatusDef[] })?.statuses ?? []) as StatusDef[];
      setStatuses(nextStatuses);
      setTags(((value(tagRes) as { tags?: TagDef[] })?.tags ?? []) as TagDef[]);
      setStatusId((current) => current ?? nextStatuses.find((status) => status.isDefault)?.id ?? nextStatuses[0]?.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const toggleTagOption = (tag: TagDef, optionId: string) => {
    setTagIds((current) => {
      const optionIds = new Set(tag.options.map((option) => option.id));
      const others = current.filter((id) => !optionIds.has(id));
      const selectedForTag = current.filter((id) => optionIds.has(id));
      const isSelected = selectedForTag.includes(optionId);
      const nextForTag =
        tag.type === "single_select"
          ? isSelected
            ? []
            : [optionId]
          : isSelected
            ? selectedForTag.filter((id) => id !== optionId)
            : [...selectedForTag, optionId];
      return [...others, ...nextForTag];
    });
  };

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    // On success the dashboard host closes this overlay and refreshes the board.
    await host.call("commands.execute", {
      commandId: CREATE_TICKET,
      params: { title: deriveTitle(trimmed), content: trimmed, statusId, tagIds },
    });
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

      <Flex justify="flex-end">
        <Button size="sm" variant="solid" loading={submitting} disabled={!content.trim()} onClick={() => void submit()}>
          Create ticket
        </Button>
      </Flex>
    </Stack>
  );
};

export default createTicketView(() => <CreateTicketModal />);

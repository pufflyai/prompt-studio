import { Box, Button, Center, Flex, Icon, IconButton, Spinner, Text, Wrap } from "@chakra-ui/react";
import { installPrismGlobal, Tooltip } from "@pstdio/ui";
import type { MarkdownEditorProps } from "@pstdio/ui/rich-text";
import { useMutation } from "@tanstack/react-query";
import { Circle, Paperclip } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import { useTicketHost, useTicketHostProps, useTicketTranslation } from "../hooks/host-context";
import { runCommand, useCommandQuery } from "../hooks/use-command";
import { FileAttachmentBadge } from "./file-attachment-badge";
import { SingleTagSelector, type TagSelectorTag } from "./single-tag-selector";
import { createTicketView } from "./view-shell";

const CREATE_TICKET = "pstdio-planner.create-ticket";
const ATTACH_FILE = "pstdio-planner.attach-file";
const READ_STATUSES = "pstdio-planner.ticketStatus.read";
const READ_TAGS = "pstdio-planner.ticketTag.read";

interface StatusDef {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
}

interface CreatedTicket {
  id: string;
}

const CreateTicketModal = () => {
  const { files, host } = useTicketHost();
  const { resource } = useTicketHostProps();
  const t = useTicketTranslation();
  const targetStatusId = resource?.id;

  const [Editor, setEditor] = useState<ComponentType<MarkdownEditorProps> | null>(null);

  const [content, setContent] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const statusesQuery = useCommandQuery<{ statuses?: StatusDef[] }>({
    queryKey: ["statuses"],
    commandId: READ_STATUSES,
  });
  const tagsQuery = useCommandQuery<{ tags?: TagSelectorTag[] }>({ queryKey: ["tags"], commandId: READ_TAGS });

  const statuses = statusesQuery.data?.statuses ?? [];
  const tags = tagsQuery.data?.tags ?? [];
  const statusId = targetStatusId ?? statuses.find((status) => status.isDefault)?.id ?? statuses[0]?.id;

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
      await runCommand(host, ATTACH_FILE, { ticketId, ref });
    }
  };

  // On success the dashboard host closes this overlay and refreshes the board.
  const createTicket = useMutation({
    mutationFn: async () => {
      const created = await runCommand<CreatedTicket>(host, CREATE_TICKET, {
        content: content.trim(),
        statusId,
        tagIds,
      });
      await uploadAttachments(created.id);
    },
    onError: (error) =>
      void host
        .call("notification.show", {
          level: "error",
          title: t("createTicketModal.errors.createFailed", "Could not create ticket"),
          message: error instanceof Error ? error.message : String(error),
        })
        .catch(() => undefined),
  });
  const submitting = createTicket.isPending;

  const submit = () => {
    if (!content.trim() || submitting) return;
    createTicket.mutate();
  };

  const loading = statusesQuery.isPending || tagsQuery.isPending;

  if (loading || !Editor) {
    return (
      <Center h="full" minH="0" w="full">
        <Spinner />
      </Center>
    );
  }

  const selectedStatus = statuses.find((status) => status.id === statusId);
  const statusLabel = selectedStatus?.name ?? t("createTicketModal.noStatus", "No status");
  const statusColor = selectedStatus?.color ?? "gray";

  return (
    <Flex direction="column" h="full" minH="0" overflow="hidden" w="full" bg="bg">
      <Box as="header" py="xs" px="sm" flexShrink={0}>
        <Text textStyle="label/S/medium">{t("createTicketModal.newTicket", "New ticket")}</Text>
      </Box>

      <Flex px="sm" py="sm" direction="column" gap="sm" flex="1" minH="0" overflow="hidden">
        <Box flex="1" minH="120px" minW="0" overflow="hidden">
          <Editor
            defaultState=""
            isEditable={!submitting}
            placeholder={t("createTicketModal.describePlaceholder", "Describe the ticket...")}
            autoFocus
            onChange={setContent}
          />
        </Box>

        <Wrap gap="2xs" align="center" flexShrink={0}>
          <Button size="xs" variant="outline" colorPalette={statusColor} disabled>
            <Icon as={Circle} boxSize="3" color={`${statusColor}.fg`} fill={`${statusColor}.fg`} />
            {statusLabel}
          </Button>

          {tags.map((tag) => (
            <SingleTagSelector
              key={tag.id}
              tag={tag}
              selectedOptionIds={tagIds}
              isDisabled={submitting}
              size="xs"
              onChange={setTagIds}
            />
          ))}
        </Wrap>

        {selectedFiles.length > 0 ? (
          <Wrap gap="2xs" flexShrink={0}>
            {selectedFiles.map((file, index) => (
              <FileAttachmentBadge
                key={`${file.name}-${index.toString()}`}
                file={file}
                disabled={submitting}
                onRemove={() => setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
          </Wrap>
        ) : null}
      </Flex>

      <Box as="footer" px="sm" py="sm" flexShrink={0}>
        <Flex width="100%" alignItems="center" justifyContent="space-between" gap="2">
          <Tooltip content={t("createTicketModal.attachFiles", "Attach files")}>
            <IconButton
              size="xs"
              variant="ghost"
              aria-label={t("createTicketModal.attachFiles", "Attach files")}
              disabled={submitting}
              onClick={() => void pickFiles()}
            >
              <Icon as={Paperclip} boxSize="4" />
            </IconButton>
          </Tooltip>
          <Button
            size="sm"
            variant="primary"
            loading={submitting}
            disabled={!content.trim() || submitting}
            onClick={() => void submit()}
          >
            {t("createTicketModal.createTicket", "Create ticket")}
          </Button>
        </Flex>
      </Box>
    </Flex>
  );
};

export default createTicketView(() => <CreateTicketModal />);

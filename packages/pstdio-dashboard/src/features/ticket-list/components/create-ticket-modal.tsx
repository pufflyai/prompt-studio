import { Box, Button, CloseButton, Dialog, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { ChevronRight, Circle, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SingleTagSelector } from "@/features/ticket/components/single-tag-selector";

import type { TicketStatus, TicketStatusOption, TicketTag } from "@/features/ticket-list/types";

interface CreateTicketModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTicketModalPayload) => void | Promise<void>;
  isSubmitting?: boolean;
  targetStatus?: TicketStatus | null;
  tags?: TicketTag[];
  parentId?: string | null;
  title?: string;
  submitLabel?: string;
  projectName?: string;
  statusOptions?: TicketStatusOption[];
}

export interface CreateTicketModalPayload {
  content: string;
  tagIds: string[];
  status: TicketStatus | null;
  parentId: string | null;
  files: File[];
}

export type { CreateTicketModalProps };

const STATUS_COLOR_MAP: Record<string, string> = {
  gray: "gray.400",
  red: "red.400",
  orange: "orange.400",
  yellow: "yellow.400",
  green: "green.400",
  teal: "teal.400",
  blue: "blue.400",
  cyan: "cyan.400",
  purple: "purple.400",
  pink: "pink.400",
};

export const CreateTicketModal = (props: CreateTicketModalProps) => {
  const {
    open,
    onClose,
    onSubmit,
    isSubmitting = false,
    targetStatus = null,
    tags = [],
    parentId = null,
    title: modalTitle,
    submitLabel: submitButtonLabel,
    projectName,
    statusOptions = [],
  } = props;
  const { t } = useTranslation("tickets");

  const resolvedTitle = modalTitle ?? t("createTicketModal.newTicket");
  const resolvedSubmitLabel = submitButtonLabel ?? t("createTicketModal.createTicket");

  const [content, setContent] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  const resetForm = () => {
    setContent("");
    setTagIds([]);
    setEditorKey((k) => k + 1);
    setFiles([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    await onSubmit({
      content: content.trim(),
      tagIds,
      status: targetStatus,
      parentId,
      files,
    });

    resetForm();
  };

  const statusOption = statusOptions.find((s) => s.name === targetStatus);
  const statusLabel = statusOption?.name ?? targetStatus ?? t("createTicketModal.noStatus");
  const statusColor = STATUS_COLOR_MAP[statusOption?.color ?? "gray"] ?? "gray.400";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    setFiles((prev) => [...prev, ...Array.from(selectedFiles)]);
    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose} closeOnInteractOutside={false}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="640px">
          <Dialog.Header py="xs" px="sm">
            <Flex alignItems="center" gap="2xs" flex="1">
              {projectName && (
                <>
                  <Text textStyle="label/S/medium" color="fg.muted">
                    {projectName}
                  </Text>
                  <Icon as={ChevronRight} boxSize="3" color="fg.subtle" />
                </>
              )}
              <Text textStyle="label/S/medium">{resolvedTitle}</Text>
            </Flex>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body px="sm" py="sm">
            <Stack gap="0">
              <Box minH="180px">
                <MarkdownEditor
                  key={editorKey}
                  defaultState={content}
                  isEditable={!isSubmitting}
                  onChange={setContent}
                  placeholder={t("createTicketModal.describePlaceholder")}
                  autoFocus
                />
              </Box>
            </Stack>
          </Dialog.Body>

          <Flex px="sm" py="2xs" gap="2xs" flexWrap="wrap" alignItems="center">
            <Button size="xs" variant="outline" disabled>
              <Icon as={Circle} boxSize="3" color={statusColor} fill={statusColor} />
              {statusLabel}
            </Button>

            {tags.map((tag) => (
              <SingleTagSelector
                key={tag.id}
                tag={tag}
                selectedOptionIds={tagIds}
                onChange={setTagIds}
                isDisabled={isSubmitting}
                size="xs"
                variant="outline"
              />
            ))}
          </Flex>

          {files.length > 0 && (
            <Flex px="sm" py="2xs" gap="2xs" flexWrap="wrap">
              {files.map((file, index) => (
                <Button
                  key={`${file.name}-${index}`}
                  size="xs"
                  variant="outline"
                  onClick={() => handleRemoveFile(index)}
                >
                  {file.name}
                </Button>
              ))}
            </Flex>
          )}

          <Dialog.Footer px="sm" py="xs">
            <Flex width="100%" alignItems="center" justifyContent="space-between">
              <Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
                <Button size="xs" variant="ghost" disabled={isSubmitting} onClick={() => fileInputRef.current?.click()}>
                  <Icon as={Paperclip} boxSize="4" />
                </Button>
              </Box>
              <Button size="sm" variant="primary" onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit}>
                {resolvedSubmitLabel}
              </Button>
            </Flex>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

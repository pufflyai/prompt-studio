import { Box, Button, CloseButton, Dialog, Flex, Icon, Menu, Stack, Text } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { BarChart3, ChevronRight, Circle, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { TicketStatus, TicketStatusOption, TicketTag } from "@/features/ticket-list/types";

interface TemplateOption {
  id: string;
  name: string;
}

interface CreateTicketModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTicketModalPayload) => void | Promise<void>;
  isSubmitting?: boolean;
  targetStatus?: TicketStatus | null;
  templates?: TemplateOption[];
  tags?: TicketTag[];
  parentId?: string | null;
  title?: string;
  submitLabel?: string;
  projectName?: string;
  statusOptions?: TicketStatusOption[];
}

export interface CreateTicketModalPayload {
  content: string;
  complexity: "low" | "medium" | "high";
  tagIds: string[];
  templateName: string | null;
  status: TicketStatus | null;
  parentId: string | null;
  files: File[];
}

export type { CreateTicketModalProps };

const COMPLEXITY_OPTIONS = ["low", "medium", "high"] as const;

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

const COMPLEXITY_ICON_COLOR: Record<string, string> = {
  low: "green.400",
  medium: "orange.400",
  high: "red.400",
};

export const CreateTicketModal = (props: CreateTicketModalProps) => {
  const {
    open,
    onClose,
    onSubmit,
    isSubmitting = false,
    targetStatus = null,
    templates = [],
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
  const [complexity, setComplexity] = useState<"low" | "medium" | "high">("medium");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  const resetForm = () => {
    setContent("");
    setComplexity("medium");
    setTagIds([]);
    setTemplateName("");
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
      complexity,
      tagIds,
      templateName: templateName || null,
      status: targetStatus,
      parentId,
      files,
    });

    resetForm();
  };

  const statusOption = statusOptions.find((s) => s.name === targetStatus);
  const statusLabel = statusOption?.name ?? targetStatus ?? t("createTicketModal.noStatus");
  const statusColor = STATUS_COLOR_MAP[statusOption?.color ?? "gray"] ?? "gray.400";

  const complexityLabel = t(`createTicketModal.${complexity}`);

  const selectedTagNames = tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name);
  const tagsLabel = selectedTagNames.length > 0 ? selectedTagNames.join(", ") : t("ticketDetail.tags");

  const templateLabel = templateName
    ? (templates.find((tmpl) => tmpl.name === templateName)?.name ?? templateName)
    : t("createTicketModal.template");

  const handleTagToggle = (tagId: string) => {
    setTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));
  };

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
            <Dialog.CloseTrigger>
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

            <Menu.Root>
              <Menu.Trigger asChild>
                <Button size="xs" variant="outline" disabled={isSubmitting}>
                  <Icon as={BarChart3} boxSize="3" color={COMPLEXITY_ICON_COLOR[complexity]} />
                  {complexityLabel}
                </Button>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content bg="bg">
                  {COMPLEXITY_OPTIONS.map((option) => (
                    <MenuItem
                      key={option}
                      primaryLabel={t(`createTicketModal.${option}`)}
                      isSelected={complexity === option}
                      onClick={() => setComplexity(option)}
                    />
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>

            {tags.length > 0 && (
              <Menu.Root closeOnSelect={false}>
                <Menu.Trigger asChild>
                  <Button size="xs" variant="outline" disabled={isSubmitting}>
                    {tagsLabel}
                  </Button>
                </Menu.Trigger>
                <Menu.Positioner>
                  <Menu.Content bg="bg">
                    {tags.map((tag) => (
                      <MenuItem
                        key={tag.id}
                        id={tag.id}
                        primaryLabel={tag.name}
                        isSelected={tagIds.includes(tag.id)}
                        onClick={() => handleTagToggle(tag.id)}
                      />
                    ))}
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Root>
            )}

            {templates.length > 0 && (
              <Menu.Root>
                <Menu.Trigger asChild>
                  <Button size="xs" variant="outline" disabled={isSubmitting}>
                    {templateLabel}
                  </Button>
                </Menu.Trigger>
                <Menu.Positioner>
                  <Menu.Content bg="bg">
                    <MenuItem
                      primaryLabel={t("createTicketModal.noTemplate")}
                      isSelected={templateName === ""}
                      onClick={() => setTemplateName("")}
                    />
                    {templates.map((tmpl) => (
                      <MenuItem
                        key={tmpl.id}
                        primaryLabel={tmpl.name}
                        isSelected={templateName === tmpl.name}
                        onClick={() => setTemplateName(tmpl.name)}
                      />
                    ))}
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Root>
            )}
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
              <Button size="sm" variant="solid" onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit}>
                {resolvedSubmitLabel}
              </Button>
            </Flex>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

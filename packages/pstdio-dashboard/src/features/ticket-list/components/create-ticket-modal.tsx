import { Box, Button, CloseButton, Dialog, NativeSelect, Stack, Text } from "@chakra-ui/react";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useState } from "react";

import type { TicketStatus } from "@/features/ticket-list/types";

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
  parentId?: string | null;
  title?: string;
  submitLabel?: string;
}

export interface CreateTicketModalPayload {
  content: string;
  complexity: "low" | "medium" | "high";
  templateName: string | null;
  status: TicketStatus | null;
  parentId: string | null;
}

export type { CreateTicketModalProps };

export const CreateTicketModal = (props: CreateTicketModalProps) => {
  const {
    open,
    onClose,
    onSubmit,
    isSubmitting = false,
    targetStatus = null,
    templates = [],
    parentId = null,
    title: modalTitle = "Create ticket",
    submitLabel: submitButtonLabel = "Create",
  } = props;

  const [content, setContent] = useState("");
  const [complexity, setComplexity] = useState<"low" | "medium" | "high">("medium");
  const [templateName, setTemplateName] = useState("");
  const [editorKey, setEditorKey] = useState(0);

  const canSubmit = content.trim().length > 0 && !isSubmitting;

  const resetForm = () => {
    setContent("");
    setComplexity("medium");
    setTemplateName("");
    setEditorKey((k) => k + 1);
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
      templateName: templateName || null,
      status: targetStatus,
      parentId,
    });

    resetForm();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">{modalTitle}</Text>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap="sm">
              <Stack gap="2xs">
                <Box minHeight="180px" borderWidth="1px" padding="xs" borderRadius="sm">
                  <MarkdownEditor
                    key={editorKey}
                    defaultState={content}
                    isEditable={!isSubmitting}
                    onChange={setContent}
                    placeholder="Describe the ticket..."
                    autoFocus
                  />
                </Box>
              </Stack>

              <Stack gap="2xs">
                <Text textStyle="label/S/medium">Complexity</Text>
                <NativeSelect.Root size="sm" disabled={isSubmitting}>
                  <NativeSelect.Field
                    value={complexity}
                    onChange={(event) => setComplexity(event.target.value as "low" | "medium" | "high")}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Stack>

              {templates.length > 0 && (
                <Stack gap="2xs">
                  <Text textStyle="label/S/medium">Template</Text>
                  <NativeSelect.Root size="sm" disabled={isSubmitting}>
                    <NativeSelect.Field value={templateName} onChange={(event) => setTemplateName(event.target.value)}>
                      <option value="">No template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Stack>
              )}
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button size="sm" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button size="sm" variant="solid" onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit}>
                {submitButtonLabel}
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

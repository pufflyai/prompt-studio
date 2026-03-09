import { Box, Button, CloseButton, Dialog, Icon, Menu, Stack, Text } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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

const COMPLEXITY_OPTIONS = ["low", "medium", "high"] as const;

export const CreateTicketModal = (props: CreateTicketModalProps) => {
  const {
    open,
    onClose,
    onSubmit,
    isSubmitting = false,
    targetStatus = null,
    templates = [],
    parentId = null,
    title: modalTitle,
    submitLabel: submitButtonLabel,
  } = props;
  const { t } = useTranslation("tickets");

  const resolvedTitle = modalTitle ?? t("createTicketModal.createTicket");
  const resolvedSubmitLabel = submitButtonLabel ?? t("createTicketModal.create");

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

  const complexityLabel = t(`createTicketModal.${complexity}`);
  const templateLabel = templateName
    ? (templates.find((tmpl) => tmpl.name === templateName)?.name ?? templateName)
    : t("createTicketModal.noTemplate");

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">{resolvedTitle}</Text>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap="sm">
              <Stack gap="2xs">
                <Box height="180px" borderWidth="1px" padding="xs" borderRadius="sm">
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

              <Stack gap="2xs">
                <Text textStyle="label/S/medium">{t("createTicketModal.complexity")}</Text>
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      width="full"
                      justifyContent="space-between"
                      disabled={isSubmitting}
                    >
                      {complexityLabel}
                      <Icon as={ChevronDown} color="fg.muted" />
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
              </Stack>

              {templates.length > 0 && (
                <Stack gap="2xs">
                  <Text textStyle="label/S/medium">{t("createTicketModal.template")}</Text>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        width="full"
                        justifyContent="space-between"
                        disabled={isSubmitting}
                      >
                        {templateLabel}
                        <Icon as={ChevronDown} color="fg.muted" />
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
                </Stack>
              )}
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button size="sm" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                {t("createTicketModal.cancel")}
              </Button>
              <Button size="sm" variant="solid" onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit}>
                {resolvedSubmitLabel}
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

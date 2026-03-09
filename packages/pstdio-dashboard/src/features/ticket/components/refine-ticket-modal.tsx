import { Button, CloseButton, Dialog, Icon, Menu, Stack, Text, Textarea } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkspaceAgentBrowserContainer } from "@/features/agents/components/agent-browser.container";

interface TemplateOption {
  id: string;
  name: string;
}

interface RefineTicketModalProps {
  open: boolean;
  ticketShorthand: string;
  templates?: TemplateOption[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (additionalContext: string, templateName: string | null) => Promise<boolean> | boolean;
}

export const RefineTicketModal = (props: RefineTicketModalProps) => {
  const { open, ticketShorthand, templates = [], isSubmitting = false, onClose, onSubmit } = props;
  const { t } = useTranslation("tickets");
  const [additionalContext, setAdditionalContext] = useState("");
  const [templateName, setTemplateName] = useState("");

  const handleClose = () => {
    if (isSubmitting) return;

    setAdditionalContext("");
    setTemplateName("");
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const started = await onSubmit(additionalContext, templateName || null);
    if (!started) return;

    setAdditionalContext("");
    setTemplateName("");
    onClose();
  };

  const templateLabel = templateName
    ? (templates.find((tmpl) => tmpl.name === templateName)?.name ?? templateName)
    : t("refineTicketModal.noTemplate");

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && handleClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">{t("refineTicketModal.title")}</Text>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" disabled={isSubmitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap="sm">
              <Text textStyle="paragraph/S/regular" color="foreground.secondary">
                {t("refineTicketModal.description")}
              </Text>

              <Stack gap="2xs">
                <Text textStyle="label/S/medium">{t("refineTicketModal.additionalInfo")}</Text>
                <Textarea
                  size="sm"
                  minH="120px"
                  value={additionalContext}
                  onChange={(event) => setAdditionalContext(event.target.value)}
                  placeholder={t("refineTicketModal.placeholder", { ticketShorthand })}
                  disabled={isSubmitting}
                />
              </Stack>

              {templates.length > 0 ? (
                <Stack gap="2xs">
                  <Text textStyle="label/S/medium">{t("refineTicketModal.template")}</Text>
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
                          primaryLabel={t("refineTicketModal.noTemplate")}
                          isSelected={templateName === ""}
                          onClick={() => setTemplateName("")}
                        />
                        {templates.map((template) => (
                          <MenuItem
                            key={template.id}
                            primaryLabel={template.name}
                            isSelected={templateName === template.name}
                            onClick={() => setTemplateName(template.name)}
                          />
                        ))}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Root>
                </Stack>
              ) : null}

              <Stack gap="2xs">
                <Text textStyle="label/S/medium">{t("refineTicketModal.agent")}</Text>
                <WorkspaceAgentBrowserContainer isDisabled={isSubmitting} />
              </Stack>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button size="sm" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                {t("refineTicketModal.cancel")}
              </Button>
              <Button size="sm" variant="solid" onClick={handleSubmit} loading={isSubmitting}>
                {t("refineTicketModal.submit")}
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

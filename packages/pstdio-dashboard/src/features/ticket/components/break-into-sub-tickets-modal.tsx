import { Button, CloseButton, Dialog, Icon, Menu, Stack, Text } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";

interface TemplateOption {
  id: string;
  name: string;
}

interface BreakIntoSubTicketsModalProps {
  open: boolean;
  ticketShorthand: string;
  templates?: TemplateOption[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (templateName: string | null) => Promise<boolean> | boolean;
}

export const BreakIntoSubTicketsModal = (props: BreakIntoSubTicketsModalProps) => {
  const { open, ticketShorthand, templates = [], isSubmitting = false, onClose, onSubmit } = props;
  const { t } = useTranslation("tickets");
  const [templateName, setTemplateName] = useState("");

  const handleClose = () => {
    if (isSubmitting) return;

    setTemplateName("");
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const started = await onSubmit(templateName || null);
    if (!started) return;

    setTemplateName("");
    onClose();
  };

  const templateLabel = templateName
    ? (templates.find((tmpl) => tmpl.name === templateName)?.name ?? templateName)
    : t("breakIntoSubTicketsModal.noTemplate");

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && handleClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Text textStyle="heading/M">{t("breakIntoSubTicketsModal.title")}</Text>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" disabled={isSubmitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap="sm">
              <Text textStyle="paragraph/S/regular" color="foreground.secondary">
                {t("breakIntoSubTicketsModal.description", { ticketShorthand })}
              </Text>

              {templates.length > 0 ? (
                <Stack gap="2xs">
                  <Text textStyle="label/S/medium">{t("breakIntoSubTicketsModal.template")}</Text>
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
                          primaryLabel={t("breakIntoSubTicketsModal.noTemplate")}
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
                <Text textStyle="label/S/medium">{t("breakIntoSubTicketsModal.agent")}</Text>
                <AgentBrowserContainer isDisabled={isSubmitting} />
              </Stack>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Stack direction="row" gap="1">
              <Button size="sm" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                {t("breakIntoSubTicketsModal.cancel")}
              </Button>
              <Button size="sm" variant="solid" onClick={handleSubmit} loading={isSubmitting}>
                {t("breakIntoSubTicketsModal.submit")}
              </Button>
            </Stack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

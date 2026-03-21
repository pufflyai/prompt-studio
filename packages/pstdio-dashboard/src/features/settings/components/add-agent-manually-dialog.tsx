import { Button, CloseButton, Dialog, Input, Menu, Stack, Text } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const SUPPORTED_AGENT_IDS = ["claude-code", "opencode"] as const;
export type SupportedAgentId = (typeof SUPPORTED_AGENT_IDS)[number];

interface AddAgentManuallyDialogProps {
  open: boolean;
  isSubmitting: boolean;
  existingAgentIds: string[];
  onClose: () => void;
  onCreate: (agentId: SupportedAgentId, binary: string) => Promise<void>;
}

const DEFAULT_AGENT_ID: SupportedAgentId = "claude-code";

export const AddAgentManuallyDialog = (props: AddAgentManuallyDialogProps) => {
  const { t } = useTranslation("settings");
  const { open, isSubmitting, existingAgentIds, onClose, onCreate } = props;

  const availableAgentIds = SUPPORTED_AGENT_IDS.filter((id) => !existingAgentIds.includes(id));

  const [agentId, setAgentId] = useState<SupportedAgentId>(DEFAULT_AGENT_ID);
  const [binaryPath, setBinaryPath] = useState("");

  useEffect(() => {
    if (!open) {
      setAgentId(availableAgentIds[0] ?? DEFAULT_AGENT_ID);
      setBinaryPath("");
    }
  }, [open, availableAgentIds]);

  const handleCreate = async () => {
    const trimmed = binaryPath.trim();
    if (!trimmed) {
      return;
    }

    await onCreate(agentId, trimmed);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{t("agentList.manualAddTitle")}</Dialog.Title>
            <Dialog.CloseTrigger>
              <CloseButton size="sm" disabled={isSubmitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap="sm">
              <Stack gap="2xs">
                <Text textStyle="label/S/medium">{t("agentList.manualAddAgent")}</Text>
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      width="full"
                      justifyContent="space-between"
                      disabled={isSubmitting}
                    >
                      {agentId}
                      <ChevronDown size={16} />
                    </Button>
                  </Menu.Trigger>
                  <Menu.Positioner>
                    <Menu.Content minW="200px" bg="bg">
                      {availableAgentIds.map((id) => (
                        <MenuItem
                          key={id}
                          id={id}
                          primaryLabel={id}
                          isSelected={id === agentId}
                          onClick={() => setAgentId(id)}
                        />
                      ))}
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Root>
              </Stack>

              <Stack gap="2xs">
                <Text textStyle="label/S/medium">{t("agentList.manualAddBinary")}</Text>
                <Input
                  value={binaryPath}
                  onChange={(event) => setBinaryPath(event.target.value)}
                  placeholder={t("agentList.manualAddBinaryPlaceholder")}
                  disabled={isSubmitting}
                />
              </Stack>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Button size="sm" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              {t("agentList.cancel")}
            </Button>
            <Button
              size="sm"
              variant="solid"
              onClick={handleCreate}
              loading={isSubmitting}
              disabled={binaryPath.trim().length === 0}
            >
              {t("agentList.addAgent")}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

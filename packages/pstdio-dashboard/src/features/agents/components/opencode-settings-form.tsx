import { Button, HStack, Icon, Menu, Spinner, Stack, Switch, Text } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentModels } from "../hooks/use-agent-models";
import type { OpencodeSettings } from "../types";

interface OpencodeSettingsFormProps {
  settings: OpencodeSettings;
  onUpdate: (partial: Partial<OpencodeSettings>) => void;
  isUpdating: boolean;
}

export const OpencodeSettingsForm = (props: OpencodeSettingsFormProps) => {
  const { t } = useTranslation("settings");
  const { settings, onUpdate, isUpdating } = props;
  const { data: models = [], isLoading: isModelsLoading } = useAgentModels("opencode", { enabled: true });

  const selectedModelLabel = settings.model ?? t("opencode.agentDefault");

  return (
    <Stack gap="sm">
      <HStack justify="space-between" alignItems="center">
        <Stack gap="0">
          <Text textStyle="label/XS/medium">{t("opencode.model")}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("opencode.modelDescription")}
          </Text>
        </Stack>

        {isModelsLoading ? (
          <Spinner size="xs" />
        ) : (
          <Menu.Root>
            <Menu.Trigger asChild>
              <Button
                size="sm"
                variant="outline"
                width="auto"
                minW="220px"
                justifyContent="space-between"
                disabled={isUpdating}
              >
                {selectedModelLabel}
                <Icon as={ChevronDown} color="fg.muted" />
              </Button>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content minW="220px" bg="bg">
                <MenuItem
                  primaryLabel={t("opencode.agentDefault")}
                  isSelected={!settings.model}
                  onClick={() => onUpdate({ model: undefined })}
                />
                {models.map((m) => (
                  <MenuItem
                    key={m.id}
                    primaryLabel={m.id}
                    isSelected={settings.model === m.id}
                    onClick={() => onUpdate({ model: m.id })}
                  />
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        )}
      </HStack>

      <HStack justify="space-between" alignItems="center">
        <Stack gap="0">
          <Text textStyle="label/XS/medium">{t("opencode.autoApprove")}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("opencode.autoApproveDescription")}
          </Text>
        </Stack>

        <Switch.Root
          checked={settings.autoApprove ?? false}
          onCheckedChange={(e) => onUpdate({ autoApprove: e.checked })}
          disabled={isUpdating}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>
    </Stack>
  );
};

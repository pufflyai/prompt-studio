import { Button, HStack, Icon, Menu, Spinner, Stack, Text } from "@chakra-ui/react";
import { ListRow, Switch } from "@pstdio/ui";
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
                <Menu.Item value="default" asChild>
                  <ListRow
                    asChild
                    variant="compact"
                    id="default"
                    label={t("opencode.agentDefault")}
                    isSelected={!settings.model}
                    onActivate={() => onUpdate({ model: undefined })}
                  />
                </Menu.Item>
                {models.map((m) => (
                  <Menu.Item key={m.id} value={m.id} asChild>
                    <ListRow
                      asChild
                      variant="compact"
                      id={m.id}
                      label={m.id}
                      isSelected={settings.model === m.id}
                      onActivate={() => onUpdate({ model: m.id })}
                    />
                  </Menu.Item>
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

        <Switch
          checked={settings.autoApprove ?? false}
          onCheckedChange={(e: { checked: boolean }) => onUpdate({ autoApprove: e.checked })}
          disabled={isUpdating}
        />
      </HStack>
    </Stack>
  );
};

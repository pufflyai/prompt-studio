import { HStack, NativeSelect, Spinner, Stack, Switch, Text } from "@chakra-ui/react";
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
          <NativeSelect.Root size="sm" width="auto" minW="220px" disabled={isUpdating}>
            <NativeSelect.Field
              value={settings.model ?? ""}
              onChange={(e) => onUpdate({ model: e.target.value || undefined })}
            >
              <option value="">{t("opencode.agentDefault")}</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
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

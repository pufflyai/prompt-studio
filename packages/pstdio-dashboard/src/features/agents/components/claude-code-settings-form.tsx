import { HStack, NativeSelect, Spinner, Stack, Switch, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useAgentModels } from "../hooks/use-agent-models";
import type { ClaudeCodeSettings } from "../types";

interface ClaudeCodeSettingsFormProps {
  settings: ClaudeCodeSettings;
  onUpdate: (partial: Partial<ClaudeCodeSettings>) => void;
  isUpdating: boolean;
}

export const ClaudeCodeSettingsForm = (props: ClaudeCodeSettingsFormProps) => {
  const { t } = useTranslation("settings");
  const { settings, onUpdate, isUpdating } = props;

  const APPROVAL_OPTIONS = [
    { value: "bypass", label: t("claudeCode.approvalOptions.bypass") },
    { value: "prompt", label: t("claudeCode.approvalOptions.prompt") },
  ];
  const { data: models = [], isLoading: isModelsLoading } = useAgentModels("claude-code", { enabled: true });

  return (
    <Stack gap="sm">
      <HStack justify="space-between" alignItems="center">
        <Stack gap="0">
          <Text textStyle="label/XS/medium">{t("claudeCode.model")}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("claudeCode.modelDescription")}
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
              <option value="">{t("claudeCode.agentDefault")}</option>
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
          <Text textStyle="label/XS/medium">{t("claudeCode.planMode")}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("claudeCode.planModeDescription")}
          </Text>
        </Stack>

        <Switch.Root
          checked={settings.planMode ?? false}
          onCheckedChange={(e) => onUpdate({ planMode: e.checked })}
          disabled={isUpdating}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      <HStack justify="space-between" alignItems="center">
        <Stack gap="0">
          <Text textStyle="label/XS/medium">{t("claudeCode.approvalMode")}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("claudeCode.approvalModeDescription")}
          </Text>
        </Stack>

        <NativeSelect.Root size="sm" width="auto" minW="220px" disabled={isUpdating}>
          <NativeSelect.Field
            value={settings.approvalMode ?? "bypass"}
            onChange={(e) => onUpdate({ approvalMode: e.target.value as "bypass" | "prompt" })}
          >
            {APPROVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>
    </Stack>
  );
};

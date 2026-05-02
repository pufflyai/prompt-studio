import { Button, HStack, Icon, Menu, Spinner, Stack, Text } from "@chakra-ui/react";
import { ListRow, Switch } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
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

  const selectedModelLabel = settings.model ?? t("claudeCode.agentDefault");
  const selectedApprovalLabel =
    APPROVAL_OPTIONS.find((opt) => opt.value === (settings.approvalMode ?? "bypass"))?.label ??
    APPROVAL_OPTIONS[0].label;

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
                    label={t("claudeCode.agentDefault")}
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
          <Text textStyle="label/XS/medium">{t("claudeCode.planMode")}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("claudeCode.planModeDescription")}
          </Text>
        </Stack>

        <Switch
          checked={settings.planMode ?? false}
          onCheckedChange={(e: { checked: boolean }) => onUpdate({ planMode: e.checked })}
          disabled={isUpdating}
        />
      </HStack>

      <HStack justify="space-between" alignItems="center">
        <Stack gap="0">
          <Text textStyle="label/XS/medium">{t("claudeCode.approvalMode")}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("claudeCode.approvalModeDescription")}
          </Text>
        </Stack>

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
              {selectedApprovalLabel}
              <Icon as={ChevronDown} color="fg.muted" />
            </Button>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="220px" bg="bg">
              {APPROVAL_OPTIONS.map((opt) => (
                <Menu.Item key={opt.value} value={opt.value} asChild>
                  <ListRow
                    asChild
                    variant="compact"
                    id={opt.value}
                    label={opt.label}
                    isSelected={(settings.approvalMode ?? "bypass") === opt.value}
                    onActivate={() => onUpdate({ approvalMode: opt.value as "bypass" | "prompt" })}
                  />
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </HStack>
    </Stack>
  );
};

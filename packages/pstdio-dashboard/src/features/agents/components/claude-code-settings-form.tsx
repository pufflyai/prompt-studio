import { HStack, NativeSelect, Spinner, Stack, Switch, Text } from "@chakra-ui/react";
import { useAgentModels } from "../hooks/use-agent-models";
import type { ClaudeCodeSettings } from "../types";

interface ClaudeCodeSettingsFormProps {
  settings: ClaudeCodeSettings;
  onUpdate: (partial: Partial<ClaudeCodeSettings>) => void;
  isUpdating: boolean;
}

const APPROVAL_OPTIONS = [
  { value: "bypass", label: "Bypass (auto-approve all)" },
  { value: "prompt", label: "Prompt (ask before each tool)" },
];

export const ClaudeCodeSettingsForm = (props: ClaudeCodeSettingsFormProps) => {
  const { settings, onUpdate, isUpdating } = props;
  const { data: models = [], isLoading: isModelsLoading } = useAgentModels("claude-code", { enabled: true });

  return (
    <Stack gap="sm">
      <HStack justify="space-between" alignItems="center">
        <Stack gap="0">
          <Text textStyle="label/XS/medium">Model</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            Default model for new sessions
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
              <option value="">Agent default</option>
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
          <Text textStyle="label/XS/medium">Plan mode</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            Start sessions in plan mode
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
          <Text textStyle="label/XS/medium">Approval mode</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            How tool use requests are handled
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

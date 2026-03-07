import { HStack, NativeSelect, Spinner, Stack, Switch, Text } from "@chakra-ui/react";
import { useAgentModels } from "../hooks/use-agent-models";
import type { OpencodeSettings } from "../types";

interface OpencodeSettingsFormProps {
  settings: OpencodeSettings;
  onUpdate: (partial: Partial<OpencodeSettings>) => void;
  isUpdating: boolean;
}

export const OpencodeSettingsForm = (props: OpencodeSettingsFormProps) => {
  const { settings, onUpdate, isUpdating } = props;
  const { data: models = [], isLoading: isModelsLoading } = useAgentModels("opencode", { enabled: true });

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
          <Text textStyle="label/XS/medium">Auto-approve</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            Automatically approve tool use requests
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

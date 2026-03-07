import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { useAgentSettings, useUpdateAgentSettings } from "../hooks/use-agent-settings";
import type { AgentInfo, ClaudeCodeSettings, OpencodeSettings } from "../types";
import { ClaudeCodeSettingsForm } from "./claude-code-settings-form";
import { OpencodeSettingsForm } from "./opencode-settings-form";

interface AgentSettingsPanelProps {
  agent: AgentInfo;
}

export const AgentSettingsPanel = (props: AgentSettingsPanelProps) => {
  const { agent } = props;
  const { data: settings, isLoading } = useAgentSettings(agent.id);
  const updateSettings = useUpdateAgentSettings(agent.id);

  if (isLoading) {
    return (
      <Box py="sm" display="flex" justifyContent="center">
        <Spinner size="xs" />
      </Box>
    );
  }

  const handleUpdate = (partial: Record<string, unknown>) => {
    updateSettings.mutate({ ...settings, ...partial });
  };

  if (agent.id === "claude-code") {
    return (
      <ClaudeCodeSettingsForm
        settings={(settings ?? {}) as ClaudeCodeSettings}
        onUpdate={handleUpdate}
        isUpdating={updateSettings.isPending}
      />
    );
  }

  if (agent.id === "opencode") {
    return (
      <OpencodeSettingsForm
        settings={(settings ?? {}) as OpencodeSettings}
        onUpdate={handleUpdate}
        isUpdating={updateSettings.isPending}
      />
    );
  }

  return (
    <Text textStyle="paragraph/XS/regular" color="fg.muted">
      No settings available for this agent.
    </Text>
  );
};

interface AgentSettingsSectionProps {
  agents: AgentInfo[];
}

export const AgentSettingsSection = (props: AgentSettingsSectionProps) => {
  const { agents } = props;
  const installedAgents = agents.filter((a) => a.availability.type === "INSTALLED");

  if (installedAgents.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm">
      <Stack gap="2xs">
        <Text textStyle="heading/S">Agent Settings</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Configure per-agent options like model, approval mode, and behavior.
        </Text>
      </Stack>

      <Stack gap="md">
        {installedAgents.map((agent) => (
          <Stack key={agent.id} gap="sm" px="md" py="sm" borderWidth="1px" borderColor="border.muted" borderRadius="md">
            <Text textStyle="label/S/medium">{agent.name}</Text>
            <AgentSettingsPanel agent={agent} />
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};

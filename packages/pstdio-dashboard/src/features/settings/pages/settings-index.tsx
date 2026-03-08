import { Box, Container, HStack, IconButton, Spinner, Stack, Text } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  useAgentConfigs,
  useDisableAgent,
  useEnableAgent,
  useSetDefaultAgent,
} from "@/features/agents/hooks/use-agent-configs";
import { useAgents } from "@/features/agents/hooks/use-agents";
import { AgentRow } from "../components/agent-row";

export const Settings = () => {
  const navigate = useNavigate();
  const { data: agents = [], isLoading: isLoadingAgents } = useAgents();
  const { data: configs = [], isLoading: isLoadingConfigs } = useAgentConfigs();
  const enableAgent = useEnableAgent();
  const disableAgent = useDisableAgent();
  const setDefaultAgent = useSetDefaultAgent();

  const isLoading = isLoadingAgents || isLoadingConfigs;

  const handleToggle = (agentId: string, isCurrentlyEnabled: boolean) => {
    if (isCurrentlyEnabled) {
      disableAgent.mutate(agentId, {
        onError: (error) => {
          toaster.create({ type: "error", title: "Failed to disable agent", description: error.message });
        },
      });
    } else {
      enableAgent.mutate(agentId, {
        onError: (error) => {
          toaster.create({ type: "error", title: "Failed to enable agent", description: error.message });
        },
      });
    }
  };

  const handleSetDefault = (agentId: string) => {
    setDefaultAgent.mutate(agentId, {
      onError: (error) => {
        toaster.create({ type: "error", title: "Failed to set default agent", description: error.message });
      },
    });
  };

  return (
    <Container>
      <Stack gap="lg" padding="lg">
        <HStack gap="xs" alignItems="center">
          <IconButton size="sm" variant="ghost" aria-label="Back" onClick={() => navigate({ to: "/projects" })}>
            <ArrowLeft size={18} />
          </IconButton>
          <Text textStyle="heading/M">Settings</Text>
        </HStack>

        <Stack gap="sm">
          <Stack gap="2xs">
            <Text textStyle="heading/S">Agents</Text>
            <Text textStyle="paragraph/S/regular" color="foreground.secondary">
              Registered coding agents and their availability status.
            </Text>
          </Stack>

          {isLoading ? (
            <Box py="md" display="flex" justifyContent="center">
              <Spinner size="sm" />
            </Box>
          ) : agents.length === 0 ? (
            <Text textStyle="paragraph/S/regular" color="foreground.secondary">
              No agents found.
            </Text>
          ) : (
            <Stack gap="xs">
              {agents.map((agent) => {
                const config = configs.find((c) => c.agent_id === agent.id);
                const isEnabled = !!config;
                const isDefault = config?.is_default ?? false;

                return (
                  <AgentRow
                    key={agent.id}
                    name={agent.name}
                    isInstalled={agent.availability.type === "INSTALLED"}
                    isEnabled={isEnabled}
                    isDefault={isDefault}
                    isToggling={enableAgent.isPending || disableAgent.isPending}
                    onToggle={() => handleToggle(agent.id, isEnabled)}
                    onSetDefault={() => handleSetDefault(agent.id)}
                  />
                );
              })}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Container>
  );
};

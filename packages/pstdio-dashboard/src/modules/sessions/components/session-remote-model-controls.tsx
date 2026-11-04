import { HStack, Text } from "@chakra-ui/react";
import { useAgents } from "@/shared/agents/use-agents";

// The target owns its harness and saved execution settings. Local availability must not reset them.
export const SessionRemoteModelControls = (props: { projectId?: string; agent: string; model: string }) => {
  const { projectId, agent, model } = props;
  const { data: agents = [] } = useAgents(projectId);
  const label = agents.find((option) => option.id === agent)?.name ?? "Agent";
  return (
    <HStack gap="2xs">
      <Text textStyle="label/XS/regular">{label}</Text>
      <Text textStyle="label/XS/regular">{model}</Text>
    </HStack>
  );
};

import { Box, Text } from "ink";
import type { AgentRow } from "../hooks/use-agents";

interface AgentManagerProps {
  agents: AgentRow[];
  selectedIndex: number;
  width: number;
  viewportHeight: number;
}

export function AgentManager({ agents, selectedIndex, width, viewportHeight }: AgentManagerProps) {
  if (agents.length === 0) {
    const topPad = Math.max(0, Math.floor(viewportHeight / 2) - 1);

    return (
      <Box flexDirection="column" height={viewportHeight} width={width}>
        <Box height={topPad} />
        <Box justifyContent="center">
          <Text dimColor>Loading agents...</Text>
        </Box>
      </Box>
    );
  }

  const contentLines = agents.length + 4;
  const topPad = Math.max(0, Math.floor((viewportHeight - contentLines) / 2));
  const bottomPad = Math.max(0, viewportHeight - contentLines - topPad);

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box height={topPad} />

      <Box justifyContent="center">
        <Text bold> Manage Agents </Text>
      </Box>

      <Text> </Text>

      {agents.map((agent, i) => {
        const isSelected = i === selectedIndex;

        return (
          <Text key={agent.agentId}>
            <Text color={isSelected ? "blue" : undefined}>{isSelected ? " ❯ " : "   "}</Text>
            <Text
              bold={isSelected}
              color={isSelected ? "blue" : undefined}
              backgroundColor={isSelected ? "gray" : undefined}
            >
              {agent.name}
            </Text>
            {agent.isDefault && <Text color="green"> (default)</Text>}
            {agent.configured && !agent.isDefault && <Text color="yellow"> configured</Text>}
            {!agent.configured && <Text dimColor> not configured</Text>}
            {agent.installed ? <Text color="green"> ✓ installed</Text> : <Text color="red"> ✗ not installed</Text>}
          </Text>
        );
      })}

      <Text> </Text>

      <Box justifyContent="center">
        <Text dimColor>s setup · d remove · enter default · esc cancel</Text>
      </Box>

      <Box height={bottomPad} />
    </Box>
  );
}

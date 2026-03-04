import { Box, Text } from "ink";

type TicketStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

interface StatusPickerProps {
  statuses: TicketStatus[];
  selectedIndex: number;
  width: number;
  viewportHeight: number;
}

export function StatusPicker({ statuses, selectedIndex, width, viewportHeight }: StatusPickerProps) {
  if (statuses.length === 0) {
    const topPad = Math.max(0, Math.floor(viewportHeight / 2) - 1);

    return (
      <Box flexDirection="column" height={viewportHeight} width={width}>
        <Box height={topPad} />
        <Box justifyContent="center">
          <Text dimColor>No statuses available.</Text>
        </Box>
      </Box>
    );
  }

  const contentLines = statuses.length + 4;
  const topPad = Math.max(0, Math.floor((viewportHeight - contentLines) / 2));
  const bottomPad = Math.max(0, viewportHeight - contentLines - topPad);

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box height={topPad} />

      <Box justifyContent="center">
        <Text bold> Set Status </Text>
      </Box>

      <Text> </Text>

      {statuses.map((status, i) => {
        const isSelected = i === selectedIndex;

        return (
          <Text key={status.id}>
            <Text color={isSelected ? "blue" : undefined}>{isSelected ? " ❯ " : "   "}</Text>
            <Text bold={isSelected} color={status.color}>
              {status.name}
            </Text>
          </Text>
        );
      })}

      <Text> </Text>

      <Box justifyContent="center">
        <Text dimColor>enter select · esc cancel</Text>
      </Box>

      <Box height={bottomPad} />
    </Box>
  );
}

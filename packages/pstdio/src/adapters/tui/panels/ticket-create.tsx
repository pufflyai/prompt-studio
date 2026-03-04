import { Box, Text } from "ink";

interface TicketCreateProps {
  width: number;
  viewportHeight: number;
}

export function TicketCreate({ width, viewportHeight }: TicketCreateProps) {
  const topPad = Math.max(0, Math.floor(viewportHeight / 2) - 2);
  const bottomPad = Math.max(0, viewportHeight - topPad - 4);

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box height={topPad} />

      <Box justifyContent="center">
        <Text bold> New Ticket </Text>
      </Box>

      <Text> </Text>

      <Box justifyContent="center">
        <Text dimColor>Enter a title in the input bar below</Text>
      </Box>

      <Text> </Text>

      <Box justifyContent="center">
        <Text dimColor>enter confirm · esc cancel</Text>
      </Box>

      <Box height={bottomPad} />
    </Box>
  );
}

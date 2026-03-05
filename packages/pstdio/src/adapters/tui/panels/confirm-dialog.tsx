import { Box, Text } from "ink";

interface ConfirmDialogProps {
  message: string;
  width: number;
  viewportHeight: number;
}

export function ConfirmDialog({ message, width, viewportHeight }: ConfirmDialogProps) {
  const contentLines = 5;
  const topPad = Math.max(0, Math.floor((viewportHeight - contentLines) / 2));
  const bottomPad = Math.max(0, viewportHeight - contentLines - topPad);

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box height={topPad} />
      <Box justifyContent="center">
        <Text bold color="yellow">
          Confirm
        </Text>
      </Box>
      <Text> </Text>
      <Box justifyContent="center">
        <Text>{message}</Text>
      </Box>
      <Text> </Text>
      <Box justifyContent="center">
        <Text dimColor>enter confirm · esc cancel</Text>
      </Box>
      <Box height={bottomPad} />
    </Box>
  );
}

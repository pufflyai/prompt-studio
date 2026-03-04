import { Box, Text } from "ink";

interface StatusGroupProps {
  name: string;
  width: number;
}

export function StatusGroup({ name, width }: StatusGroupProps) {
  const label = ` ${name} `;
  const lineLen = Math.max(0, width - label.length - 5);
  const line = "─".repeat(lineLen);

  return (
    <Box>
      <Text dimColor>
        {"  ── "}
        {name} {line}
      </Text>
    </Box>
  );
}

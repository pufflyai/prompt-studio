import { Text } from "ink";

interface StatusBadgeProps {
  name: string;
  color: string;
}

export function StatusBadge({ name, color }: StatusBadgeProps) {
  return (
    <Text color={color} bold>
      {name}
    </Text>
  );
}

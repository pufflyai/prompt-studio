import { Badge, Icon, Menu, Text } from "@chakra-ui/react";
import { Check } from "lucide-react";

import type { WorkspaceTagOption } from "./types";

interface TagBadgeProps {
  value: string | null;
  label?: string;
  color?: string;
  options: WorkspaceTagOption[];
  onValueChange?: (newValue: string) => void;
}

export const TagBadge = (props: TagBadgeProps) => {
  const { value, label, color = "purple", options, onValueChange } = props;

  const displayLabel = value ? (options.find((o) => o.value === value)?.label ?? value) : (label ?? "—");

  if (!onValueChange || options.length === 0) {
    return (
      <Badge variant="subtle" colorPalette={color} textStyle="label/XS/medium">
        {displayLabel}
      </Badge>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Badge
          variant="subtle"
          colorPalette={color}
          textStyle="label/XS/medium"
          cursor="pointer"
          _hover={{ opacity: 0.8 }}
          onClick={(event) => event.stopPropagation()}
        >
          {displayLabel}
        </Badge>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="160px" bg="bg" onClick={(event) => event.stopPropagation()}>
          {options.map((option) => (
            <Menu.Item key={option.value} value={option.value} onClick={() => onValueChange(option.value)}>
              <Text textStyle="label/S/regular" flex="1">
                {option.label}
              </Text>
              {option.value === value && <Icon as={Check} boxSize="14px" color="fg.muted" />}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

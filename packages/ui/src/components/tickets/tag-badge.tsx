import { Badge, HStack, Icon, Menu, Text } from "@chakra-ui/react";
import { Check } from "lucide-react";

import { getTagOptionIcon } from "./tag-option-icon";
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
  const selectedOption = value ? options.find((option) => option.value === value) : undefined;
  const selectedIcon = getTagOptionIcon(selectedOption?.icon);

  const displayLabel = value ? (selectedOption?.label ?? value) : (label ?? "—");

  if (!onValueChange || options.length === 0) {
    return (
      <Badge variant="subtle" colorPalette={color} textStyle="label/XS/medium">
        <HStack as="span" gap="1" alignItems="center">
          {selectedIcon ? <Icon as={selectedIcon} boxSize="12px" /> : null}
          <Text as="span">{displayLabel}</Text>
        </HStack>
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
          <HStack as="span" gap="1" alignItems="center">
            {selectedIcon ? <Icon as={selectedIcon} boxSize="12px" /> : null}
            <Text as="span">{displayLabel}</Text>
          </HStack>
        </Badge>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="160px" bg="bg" onClick={(event) => event.stopPropagation()}>
          {options.map((option) => {
            const optionIcon = getTagOptionIcon(option.icon);

            return (
              <Menu.Item key={option.value} value={option.value} onClick={() => onValueChange(option.value)}>
                {optionIcon ? <Icon as={optionIcon} boxSize="14px" color="fg.muted" /> : null}
                <Text textStyle="label/S/regular" flex="1">
                  {option.label}
                </Text>
                {option.value === value && <Icon as={Check} boxSize="14px" color="fg.muted" />}
              </Menu.Item>
            );
          })}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

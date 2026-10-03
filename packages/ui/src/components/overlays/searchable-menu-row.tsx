import { Box, HStack, Icon, Menu, Text } from "@chakra-ui/react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { ListRow } from "@/components/list-row/list-row";
import { Checkbox } from "@/components/primitives/checkbox";
import type { SearchableMenuItem } from "./searchable-menu";

interface SearchableMenuRowProps {
  item: SearchableMenuItem;
  multiple: boolean;
}

export const SearchableMenuRow = (props: SearchableMenuRowProps) => {
  const { item, multiple } = props;
  const iconSize = item.variant === "compact" ? "3" : "3.5";
  let endContent: ReactNode = multiple ? (
    <HStack gap="xs">
      {item.secondaryLabel}
      <Checkbox
        checked={Boolean(item.isSelected)}
        readOnly
        pointerEvents="none"
        size="sm"
        inputProps={{ tabIndex: -1, "aria-hidden": true }}
      />
    </HStack>
  ) : undefined;
  if (!multiple && item.isSelected) endContent = <Icon as={Check} boxSize="3.5" />;
  const content = (
    <Box
      bg="transparent"
      h="auto"
      p="0"
      _hover={{ bg: "transparent" }}
      _focus={{ bg: "transparent" }}
      _active={{ bg: "transparent" }}
    >
      <ListRow
        asChild
        id={item.id}
        role="presentation"
        variant={item.variant ?? "full-width"}
        disabled={item.isDisabled}
        tooltip={item.tooltipLabel}
        description={multiple ? undefined : item.secondaryLabel}
        isSelected={!multiple && item.isSelected}
        label={
          multiple ? (
            <HStack minW="0" gap="xs">
              {item.icon ? <Icon as={item.icon} boxSize={iconSize} color={item.iconColor ?? "fg.muted"} /> : null}
              <Text textStyle="label/S/regular" truncate>
                {item.label}
              </Text>
            </HStack>
          ) : (
            item.label
          )
        }
        icon={
          !multiple && item.icon ? (
            <Icon as={item.icon} boxSize={iconSize} color={item.iconColor ?? "fg.muted"} />
          ) : undefined
        }
        endContent={endContent}
      />
    </Box>
  );
  if (multiple)
    return (
      <Menu.CheckboxItem
        value={item.id}
        checked={Boolean(item.isSelected)}
        disabled={item.isDisabled}
        onCheckedChange={item.onSelect}
        asChild
      >
        {content}
      </Menu.CheckboxItem>
    );
  return (
    <Menu.Item value={item.id} disabled={item.isDisabled} onClick={item.onSelect} asChild>
      {content}
    </Menu.Item>
  );
};

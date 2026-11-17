import { Button, HStack, Icon, Text } from "@chakra-ui/react";
import { Check, ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { ScopedMenu as Menu } from "@/utils/scoped-overlays";
import type { MenuOption } from "./kanban-renderer-helpers";

export interface DisplayMenuSelectProps {
  label: string;
  value: string;
  options: MenuOption[];
  onSelect: (value: string) => void;
}

/** A Display menu row: the setting's name on the left, its value and a menu on the right. */
export const DisplayMenuSelect = (props: DisplayMenuSelectProps) => {
  const selectedLabel = props.options.find((option) => option.value === props.value)?.label ?? props.label;
  const hasNoneFirst = props.options[0]?.value === "none";

  return (
    <Menu.Root positioning={{ strategy: "fixed", hideWhenDetached: true }}>
      <Menu.Trigger asChild>
        <Button size="xs" variant="ghost" width="full" justifyContent="flex-start" gap="xs">
          <Text textStyle="label/S/regular">{props.label}</Text>
          <HStack marginLeft="auto" minW="0" gap="2xs" color="fg.muted">
            <Text textStyle="label/S/regular" truncate>
              {selectedLabel}
            </Text>
          </HStack>
          <ChevronDown size={12} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content overflow="hidden" overflowY="hidden">
          <ScrollArea maxH="var(--available-height)" minH="0" viewportProps={{ overscrollBehavior: "contain" }}>
            {props.options.map((option, index) => (
              <Fragment key={option.value}>
                {hasNoneFirst && index === 1 ? <Menu.Separator /> : null}
                <Menu.Item value={option.value} onClick={() => props.onSelect(option.value)}>
                  <HStack width="full" gap="xs">
                    <Text textStyle="label/S/regular">{option.label}</Text>
                    {option.value === props.value ? <Icon as={Check} marginLeft="auto" boxSize="0.875rem" /> : null}
                  </HStack>
                </Menu.Item>
              </Fragment>
            ))}
          </ScrollArea>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

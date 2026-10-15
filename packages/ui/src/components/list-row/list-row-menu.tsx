import { Box, HStack, Icon, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { Fragment, type ReactElement, useRef } from "react";
import type { ResourceContextAction } from "../overlays/resource-context-menu";
import { ResourceMenuItems } from "../overlays/resource-menu-items";
import type { ListRowActionMenuItem, ListRowMenuPlacement } from "./list-row.types";

interface ListRowMenuProps {
  triggerId?: string;
  items: ListRowActionMenuItem[];
  open: boolean;
  placement?: ListRowMenuPlacement;
  children: ReactElement;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: ListRowActionMenuItem) => void;
}

const ListRowMenuItemIcon = (props: { item: ListRowActionMenuItem }) => {
  const { item } = props;
  if (!item.icon) return null;

  return (
    <Box color="fg.muted" flexShrink={0} display="inline-flex">
      {typeof item.icon === "function" ? <Icon as={item.icon} boxSize="14px" /> : item.icon}
    </Box>
  );
};

export const ListRowMenu = (props: ListRowMenuProps) => {
  const { children, items, onOpenChange, onSelect, open, placement = "right-start", triggerId } = props;
  const pending = useRef<ResourceContextAction | null>(null);

  return (
    <Menu.Root
      ids={{ trigger: triggerId }}
      open={open}
      positioning={{ placement, offset: { mainAxis: 4 } }}
      onOpenChange={(details) => onOpenChange(details.open)}
      onExitComplete={() => {
        const action = pending.current;
        pending.current = null;
        void action?.onClick?.();
      }}
    >
      <Menu.Trigger asChild>{children}</Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="200px" bg="bg">
            {items.some((item) => item.group) ? (
              <ResourceMenuItems
                actions={items.map((item) => ({
                  key: item.id,
                  label: item.label,
                  group: item.group,
                  icon: typeof item.icon === "function" ? <Icon as={item.icon} boxSize="4" /> : item.icon,
                  endContent: item.endContent,
                  isDisabled: item.disabled || item.readOnly,
                  separatorBefore: item.separatorBefore,
                  onClick: () => onSelect(item),
                }))}
                onSelect={(action) => {
                  pending.current = action;
                }}
              />
            ) : (
              items.map((item) => (
                <Fragment key={item.id}>
                  {item.separatorBefore ? <Menu.Separator /> : null}
                  <Menu.Item
                    value={item.id}
                    disabled={item.disabled || item.readOnly}
                    _disabled={item.readOnly ? { opacity: 1, cursor: "default" } : undefined}
                    onClick={() => {
                      if (!item.readOnly) onSelect(item);
                    }}
                  >
                    <HStack gap="2" minW="0" w="full" justify="space-between" alignItems="center">
                      <HStack gap="2" minW="0" flex="1" alignItems={item.description ? "flex-start" : "center"}>
                        <ListRowMenuItemIcon item={item} />
                        <Stack gap="0" minW="0">
                          <Text textStyle="label/S/regular" truncate>
                            {item.label}
                          </Text>
                          {item.description ? (
                            <Text textStyle="label/XS" color="fg.menu-item.secondary" truncate>
                              {item.description}
                            </Text>
                          ) : null}
                        </Stack>
                      </HStack>
                      {item.endContent ? <Box flexShrink={0}>{item.endContent}</Box> : null}
                    </HStack>
                  </Menu.Item>
                </Fragment>
              ))
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

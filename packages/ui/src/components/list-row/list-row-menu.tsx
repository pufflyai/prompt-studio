import { Box, HStack, Icon, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { Fragment, type ReactElement } from "react";
import type { ListRowActionMenuItem, ListRowMenuPlacement } from "./list-row.types";

interface ListRowMenuProps {
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
  const { children, items, onOpenChange, onSelect, open, placement = "right-start" } = props;

  return (
    <Menu.Root
      open={open}
      positioning={{ placement, offset: { mainAxis: 4 } }}
      onOpenChange={(details) => onOpenChange(details.open)}
    >
      <Menu.Trigger asChild>{children}</Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="200px" bg="bg">
            {items.map((item) => (
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
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

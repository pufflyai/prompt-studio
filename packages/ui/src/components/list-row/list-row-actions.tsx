import { Box, HStack, useRecipe } from "@chakra-ui/react";
import { Fragment } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import { ScopedMenu as Menu } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { ActionIconButton } from "./action-icon-button";
import type { ListRowAction } from "./list-row.types";
import { preventRowAccessoryDrag } from "./list-row-accessory-events";
import { SearchableActionMenu } from "./searchable-action-menu";

interface RowActionsProps {
  actions: ListRowAction[];
  context: { sectionId?: string; nodeId?: string };
  alwaysVisible?: boolean;
}

export const RowActions = (props: RowActionsProps) => {
  const { actions, alwaysVisible = false, context } = props;
  const accessoryRecipe = useRecipe({ key: "listRowAccessory" });
  if (actions.length === 0) return null;

  return (
    <HStack
      gap="0"
      css={accessoryRecipe({ visibility: alwaysVisible ? "always" : "hover" })}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={preventRowAccessoryDrag}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {actions.map((action) => {
        if (action.menuItems && action.menuItems.length >= 8) {
          return <SearchableActionMenu key={action.id} action={action} />;
        }

        if (action.menuItems && action.menuItems.length > 0) {
          return (
            <Menu.Root key={action.id}>
              <Menu.Trigger asChild>
                <ActionIconButton
                  tooltip={action.tooltip ?? action.label}
                  variant="ghost"
                  size="2xs"
                  aria-label={action.label}
                  disabled={action.disabled}
                >
                  {action.icon}
                </ActionIconButton>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content minW="160px" bg="bg">
                    {action.menuItems.map((item) => (
                      <Fragment key={item.id}>
                        {item.separatorBefore ? <Menu.Separator /> : null}
                        <Tooltip content={item.description} disabled={!item.description}>
                          <Menu.Item
                            value={item.id}
                            disabled={item.disabled || item.readOnly}
                            onClick={() => {
                              if (!item.readOnly) item.onAction?.();
                            }}
                          >
                            <HStack gap="2" minW="0" w="full" justify="space-between">
                              <HStack gap="2" minW="0">
                                {item.icon ? <Box>{item.icon as never}</Box> : null}
                                <Box minW="0">{item.label}</Box>
                              </HStack>
                              {item.endContent ? <Box flexShrink={0}>{item.endContent}</Box> : null}
                            </HStack>
                          </Menu.Item>
                        </Tooltip>
                      </Fragment>
                    ))}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          );
        }

        return (
          <ActionIconButton
            key={action.id}
            tooltip={action.tooltip ?? action.label}
            variant="ghost"
            size="2xs"
            aria-label={action.label}
            disabled={action.disabled}
            aria-pressed={action.pressed}
            onClick={(event) => {
              event.stopPropagation();
              action.onAction?.(context);
            }}
          >
            {action.icon}
          </ActionIconButton>
        );
      })}
    </HStack>
  );
};

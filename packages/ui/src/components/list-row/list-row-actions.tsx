import { Box, HStack, IconButton, Menu } from "@chakra-ui/react";
import { Fragment, type ReactElement } from "react";
import { Tooltip } from "../tooltip";
import type { ListRowAction } from "./list-row.types";
import { SearchableActionMenu } from "./searchable-action-menu";

interface RowActionsProps {
  actions: ListRowAction[];
  context: { sectionId?: string; nodeId?: string };
}

const keyedTooltip = (action: ListRowAction, child: ReactElement) => {
  if (action.tooltip) {
    return (
      <Tooltip key={action.id} content={action.tooltip} openDelay={300}>
        {child}
      </Tooltip>
    );
  }
  return <Fragment key={action.id}>{child}</Fragment>;
};

export const RowActions = (props: RowActionsProps) => {
  const { actions, context } = props;
  if (actions.length === 0) return null;

  return (
    <HStack
      gap="0"
      opacity="0"
      pointerEvents="none"
      _groupHover={{ opacity: "1", pointerEvents: "auto" }}
      _groupFocusWithin={{ opacity: "1", pointerEvents: "auto" }}
      transition="opacity 120ms ease"
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action) => {
        if (action.menuItems && action.menuItems.length >= 8) {
          return <SearchableActionMenu key={action.id} action={action} />;
        }

        if (action.menuItems && action.menuItems.length > 0) {
          return keyedTooltip(
            action,
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton variant="ghost" size="2xs" aria-label={action.label}>
                  {action.icon}
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content minW="160px" bg="bg">
                  {action.menuItems.map((item) => (
                    <Tooltip key={item.id} content={item.description} disabled={!item.description} openDelay={300}>
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
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>,
          );
        }

        return keyedTooltip(
          action,
          <IconButton
            variant="ghost"
            size="2xs"
            aria-label={action.label}
            onClick={(event) => {
              event.stopPropagation();
              action.onAction?.(context);
            }}
          >
            {action.icon}
          </IconButton>,
        );
      })}
    </HStack>
  );
};

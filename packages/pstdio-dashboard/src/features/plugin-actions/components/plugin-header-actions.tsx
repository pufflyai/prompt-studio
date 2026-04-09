import { Button, Flex, Icon, IconButton, Menu } from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { MoreHorizontal } from "lucide-react";
import type { ActionDescriptor } from "../api";
import { buildHeaderActionGroups, type HeaderActionItem } from "./header-action-groups";

interface PluginHeaderActionsProps {
  pluginActions?: ActionDescriptor[];
  defaultOverflowActions?: HeaderActionItem[];
  onPluginAction: (actionKey: string) => void;
  pendingActionKey?: string | null;
  isExecuting?: boolean;
  overflowLabel?: string;
}

const renderActionButton = (
  action: HeaderActionItem,
  variant: "primary" | "outline",
  pendingActionKey: string | null,
  isExecuting: boolean,
) => (
  <Button
    key={action.key}
    size="sm"
    variant={variant}
    onClick={action.onClick}
    disabled={action.isDisabled || (isExecuting && pendingActionKey !== action.key)}
    loading={pendingActionKey === action.key}
  >
    {action.label}
  </Button>
);

export const PluginHeaderActions = (props: PluginHeaderActionsProps) => {
  const {
    pluginActions,
    defaultOverflowActions = [],
    onPluginAction,
    pendingActionKey = null,
    isExecuting = false,
    overflowLabel = "More actions",
  } = props;

  const groups = buildHeaderActionGroups({
    pluginActions,
    defaultOverflowActions,
    onPluginAction,
  });

  if (groups.primary.length === 0 && groups.secondary.length === 0 && groups.overflow.length === 0) {
    return null;
  }

  return (
    <Flex align="center" gap="xs">
      {groups.primary.map((action) => renderActionButton(action, "primary", pendingActionKey, isExecuting))}
      {groups.secondary.map((action) => renderActionButton(action, "outline", pendingActionKey, isExecuting))}

      {groups.overflow.length > 0 ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton size="sm" variant="ghost" aria-label={overflowLabel} disabled={isExecuting}>
              <Icon as={MoreHorizontal} boxSize="18px" />
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="220px" bg="bg">
              {groups.overflow.map((action) => (
                <MenuItem
                  key={action.key}
                  primaryLabel={action.label}
                  leftIcon={action.icon ?? null}
                  isDisabled={action.isDisabled || isExecuting}
                  onClick={action.onClick}
                />
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      ) : null}
    </Flex>
  );
};

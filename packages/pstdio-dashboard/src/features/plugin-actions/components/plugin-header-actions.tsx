import { Button, Flex, Icon, IconButton, Menu, Skeleton } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { MoreHorizontal } from "lucide-react";
import type { ActionDescriptor } from "../api";
import { buildHeaderActionGroups, type HeaderActionItem } from "./header-action-groups";

interface PluginHeaderActionsProps {
  pluginActions?: ActionDescriptor[];
  defaultOverflowActions?: HeaderActionItem[];
  onPluginAction: (actionKey: string) => void;
  pendingActionKeys?: string[];
  overflowLabel?: string;
  isLoading?: boolean;
}

export const getHeaderActionState = (action: HeaderActionItem, pendingActionKeys: string[] = []) => {
  const isPending = pendingActionKeys.includes(action.key);

  return {
    isDisabled: Boolean(action.isDisabled || isPending),
    isPending,
  };
};

export const isOverflowMenuDisabled = (actions: HeaderActionItem[], pendingActionKeys: string[] = []) =>
  actions.length > 0 && actions.every((action) => getHeaderActionState(action, pendingActionKeys).isDisabled);

const renderActionButton = (action: HeaderActionItem, variant: "primary" | "outline", pendingActionKeys: string[]) => {
  const state = getHeaderActionState(action, pendingActionKeys);

  return (
    <Button
      key={action.key}
      size="sm"
      variant={variant}
      onClick={action.onClick}
      disabled={state.isDisabled}
      loading={state.isPending}
    >
      {action.label}
    </Button>
  );
};

export const PluginHeaderActions = (props: PluginHeaderActionsProps) => {
  const {
    pluginActions,
    defaultOverflowActions = [],
    onPluginAction,
    pendingActionKeys = [],
    overflowLabel = "More actions",
    isLoading = false,
  } = props;

  if (isLoading) {
    return (
      <Flex align="center" gap="xs">
        <Skeleton height="32px" width="82px" borderRadius="sm" />
        <Skeleton height="32px" width="82px" borderRadius="sm" />
        <Skeleton height="32px" width="32px" borderRadius="sm" />
      </Flex>
    );
  }

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
      {groups.primary.map((action) => renderActionButton(action, "primary", pendingActionKeys))}
      {groups.secondary.map((action) => renderActionButton(action, "outline", pendingActionKeys))}

      {groups.overflow.length > 0 ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={overflowLabel}
              disabled={isOverflowMenuDisabled(groups.overflow, pendingActionKeys)}
            >
              <Icon as={MoreHorizontal} boxSize="18px" />
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="220px" bg="bg">
              {groups.overflow.map((action) => {
                const state = getHeaderActionState(action, pendingActionKeys);

                return (
                  <Menu.Item key={action.key} value={action.key} asChild>
                    <ListRow
                      asChild
                      variant="compact"
                      id={action.key}
                      label={action.label}
                      icon={action.icon ? <Icon as={action.icon} boxSize="16px" /> : undefined}
                      disabled={state.isDisabled}
                      onActivate={action.onClick}
                    />
                  </Menu.Item>
                );
              })}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      ) : null}
    </Flex>
  );
};

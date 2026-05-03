import { Button, Flex, Icon, IconButton, Menu, Skeleton } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";

export type HeaderActionKind = "default" | "extension";
export type HeaderActionPlacement = "primary" | "secondary" | "overflow" | "first" | "default" | "last";

export interface HeaderActionItem {
  key: string;
  label: string;
  kind: HeaderActionKind;
  onClick: () => void;
  isDisabled?: boolean;
  icon?: LucideIcon;
  placement?: HeaderActionPlacement;
}

interface HeaderActionsProps {
  actions?: HeaderActionItem[];
  pendingActionKeys?: string[];
  overflowLabel?: string;
  isLoading?: boolean;
}

export const groupHeaderActions = (actions: HeaderActionItem[] = []) => {
  const primary: HeaderActionItem[] = [];
  const secondary: HeaderActionItem[] = [];
  const overflow: HeaderActionItem[] = [];

  for (const action of actions) {
    if (action.placement === "primary") {
      primary.push(action);
      continue;
    }

    if (action.placement === "secondary") {
      secondary.push(action);
      continue;
    }

    overflow.push(action);
  }

  return { primary, secondary, overflow };
};

export const getHeaderActionState = (action: HeaderActionItem, pendingActionKeys: string[] = []) => {
  const isPending = pendingActionKeys.includes(action.key);

  return {
    isDisabled: Boolean(action.isDisabled || isPending),
    isPending,
  };
};

export const isOverflowMenuDisabled = (actions: HeaderActionItem[], pendingActionKeys: string[] = []) =>
  actions.length > 0 && actions.every((action) => getHeaderActionState(action, pendingActionKeys).isDisabled);

const ActionButton = (props: {
  action: HeaderActionItem;
  variant: "primary" | "outline";
  pendingActionKeys: string[];
}) => {
  const { action, variant, pendingActionKeys } = props;
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

export const HeaderActions = (props: HeaderActionsProps) => {
  const { actions = [], pendingActionKeys = [], overflowLabel = "More actions", isLoading = false } = props;

  if (isLoading) {
    return (
      <Flex align="center" gap="xs">
        <Skeleton height="32px" width="82px" borderRadius="sm" />
        <Skeleton height="32px" width="82px" borderRadius="sm" />
        <Skeleton height="32px" width="32px" borderRadius="sm" />
      </Flex>
    );
  }

  if (actions.length === 0) return null;

  const groups = groupHeaderActions(actions);

  return (
    <Flex align="center" gap="xs">
      {groups.primary.map((action) => (
        <ActionButton key={action.key} action={action} variant="primary" pendingActionKeys={pendingActionKeys} />
      ))}
      {groups.secondary.map((action) => (
        <ActionButton key={action.key} action={action} variant="outline" pendingActionKeys={pendingActionKeys} />
      ))}

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

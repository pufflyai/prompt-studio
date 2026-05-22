import { Button, HStack, Icon, IconButton, Menu, Skeleton } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { MoreHorizontal } from "lucide-react";
import type { ActionDescriptor } from "../action-types";
import { renderHeaderActionIcon } from "./action-icons";

export interface HeaderActionItem {
  key: string;
  label: string;
  kind?: "default";
  onClick: () => void;
  isDisabled?: boolean;
  icon?: ActionDescriptor["icon"];
  presentation?: ActionDescriptor["presentation"];
}

interface HeaderActionsProps {
  primaryActions?: HeaderActionItem[];
  secondaryActions?: HeaderActionItem[];
  overflowActions?: HeaderActionItem[];
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
      {renderHeaderActionIcon(action.icon, "14px")}
      {action.label}
    </Button>
  );
};

export const mergeHeaderOverflowActions = (input: {
  customActions?: HeaderActionItem[];
  defaultActions?: HeaderActionItem[];
}) => {
  const { customActions = [], defaultActions = [] } = input;
  return [...customActions, ...defaultActions];
};

export const HeaderActions = (props: HeaderActionsProps) => {
  const {
    primaryActions = [],
    secondaryActions = [],
    overflowActions = [],
    pendingActionKeys = [],
    overflowLabel = "More actions",
    isLoading = false,
  } = props;

  if (isLoading) {
    return (
      <HStack align="center" gap="xs" flexShrink={0}>
        <Skeleton height="32px" width="82px" borderRadius="sm" />
        <Skeleton height="32px" width="82px" borderRadius="sm" />
        <Skeleton height="32px" width="32px" borderRadius="sm" />
      </HStack>
    );
  }

  if (primaryActions.length === 0 && secondaryActions.length === 0 && overflowActions.length === 0) {
    return null;
  }

  return (
    <HStack align="center" gap="xs" flexShrink={0}>
      {primaryActions.map((action) => renderActionButton(action, "primary", pendingActionKeys))}
      {secondaryActions.map((action) => renderActionButton(action, "outline", pendingActionKeys))}

      {overflowActions.length > 0 ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={overflowLabel}
              disabled={isOverflowMenuDisabled(overflowActions, pendingActionKeys)}
            >
              <Icon as={MoreHorizontal} boxSize="18px" />
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="220px" bg="bg">
              {overflowActions.map((action) => {
                const state = getHeaderActionState(action, pendingActionKeys);

                return (
                  <Menu.Item key={action.key} value={action.key} asChild>
                    <ListRow
                      asChild
                      variant="compact"
                      id={action.key}
                      label={action.label}
                      icon={renderHeaderActionIcon(action.icon, "16px") ?? undefined}
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
    </HStack>
  );
};

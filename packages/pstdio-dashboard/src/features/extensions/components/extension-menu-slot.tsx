import { Button, Flex, Icon, IconButton, Menu, Skeleton } from "@chakra-ui/react";
import { ListRow, toaster } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import type { CommandExecuteRequest } from "pstdio-api-contracts";
import type { ReactNode } from "react";
import {
  buildCommandOutcomeToasts,
  buildExtensionMenuActions,
  buildSlotInvocation,
  type ExtensionMenuActionItem,
  type ExtensionMenuPresentation,
  groupExtensionMenuActions,
} from "../extension-slots";
import { useExecuteExtensionCommand, useExtensionsCheck } from "../hooks/use-extensions-check";

interface ExtensionMenuSlotProps {
  slotId: string;
  slotKind: "menu";
  context?: Record<string, unknown>;
  resource?: CommandExecuteRequest["resource"];
  overflowLabel?: string;
  presentation?: ExtensionMenuPresentation;
}

interface ExtensionMenuActionsProps {
  actions: ExtensionMenuActionItem[];
  overflowLabel?: string;
  isLoading?: boolean;
  presentation?: ExtensionMenuPresentation;
}

const showOutcomeToasts = (label: string, outcome: Parameters<typeof buildCommandOutcomeToasts>[1]) => {
  for (const toast of buildCommandOutcomeToasts(label, outcome)) {
    toaster.create(toast);
  }
};

const ActionButton = (props: { action: ExtensionMenuActionItem }) => {
  const { action } = props;

  return (
    <Button size="sm" variant="outline" disabled={action.isDisabled} onClick={action.onClick}>
      {action.label}
    </Button>
  );
};

const OverflowMenu = (props: { actions: ExtensionMenuActionItem[]; label: string }) => {
  const { actions, label } = props;
  if (actions.length === 0) return null;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton size="sm" variant="ghost" aria-label={label}>
          <Icon as={MoreHorizontal} boxSize="18px" />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" bg="bg">
          {actions.map((action) => (
            <Menu.Item key={action.key} value={action.key} asChild>
              <ListRow
                asChild
                variant="compact"
                id={action.key}
                label={action.label}
                disabled={action.isDisabled}
                onActivate={action.onClick}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

export const ExtensionMenuActions = (props: ExtensionMenuActionsProps) => {
  const { actions, overflowLabel = "Extension actions", isLoading = false, presentation = "overflow-menu" } = props;

  if (isLoading) {
    return (
      <Flex align="center" gap="xs">
        <Skeleton height="32px" width="96px" borderRadius="sm" />
      </Flex>
    );
  }

  if (actions.length === 0) return null;

  const groups = groupExtensionMenuActions(actions, presentation);
  const content: ReactNode[] = [
    ...groups.primary.map((action) => <ActionButton key={action.key} action={action} />),
    <OverflowMenu key="overflow" actions={groups.overflow} label={overflowLabel} />,
  ];

  return (
    <Flex align="center" gap="xs">
      {content}
    </Flex>
  );
};

export const ExtensionMenuSlot = (props: ExtensionMenuSlotProps) => {
  const {
    slotId,
    slotKind,
    context = {},
    resource,
    overflowLabel = "Extension actions",
    presentation = "overflow-menu",
  } = props;
  const { projectId } = useParams({ strict: false });
  const checkQuery = useExtensionsCheck();
  const executeCommand = useExecuteExtensionCommand();

  const actions = buildExtensionMenuActions({
    slotId,
    contributions: checkQuery.data?.menuContributions,
    pendingCommandIds: executeCommand.isPending ? [executeCommand.variables?.[0] ?? ""] : [],
    onExecute: (contribution) => {
      if (!projectId) return;

      executeCommand.mutate(
        [
          contribution.commandId,
          {
            projectId,
            params: contribution.params,
            resource,
            slot: buildSlotInvocation(slotId, slotKind, { projectId, ...context }),
            source: "dashboard",
          },
        ],
        {
          onSuccess: (response) => showOutcomeToasts(contribution.label, response.outcome),
        },
      );
    },
  });

  return (
    <ExtensionMenuActions
      actions={actions}
      overflowLabel={overflowLabel}
      isLoading={checkQuery.isLoading}
      presentation={presentation}
    />
  );
};

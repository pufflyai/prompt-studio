import { Button, HStack, IconButton, Menu } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useExtensionActionTrigger } from "../hooks/use-extension-action-trigger";
import type { ExtensionResourceContext } from "../types";
import { renderHeaderActionIcon } from "./action-icons";
import { ActionParamsDialog } from "./action-params-dialog";

interface ExtensionMenuSlotProps {
  slotId: string;
  /**
   * "buttons" renders every contribution as an inline button (use for "primary" slots like header buttons).
   * "overflow" collapses every contribution into a single `…` menu (use for overflow slots).
   */
  mode: "buttons" | "overflow";
  resource?: ExtensionResourceContext;
  enabled?: boolean;
}

export const getExtensionActionButtonVariant = (input: {
  slotId: string;
  presentation?: "menu-item" | "button" | "icon-button";
}) => {
  const { slotId, presentation } = input;
  if (presentation === "button" || (presentation !== "menu-item" && slotId.endsWith(".headerPrimary"))) {
    return "primary";
  }

  return "outline";
};

export const ExtensionMenuSlot = (props: ExtensionMenuSlotProps) => {
  const { slotId, mode, resource, enabled = true } = props;
  const { projectId } = useParams({ strict: false });
  const actionTrigger = useExtensionActionTrigger({ slotId, resource, enabled });
  const actions = actionTrigger.actions;

  if (!projectId || !enabled || actions.length === 0) {
    return null;
  }

  const paramsDialog =
    actionTrigger.activeParamAction && projectId ? (
      <ActionParamsDialog
        open
        action={actionTrigger.activeParamAction}
        projectId={projectId}
        isSubmitting={actionTrigger.activeParamActionIsPending}
        onClose={actionTrigger.cancelParams}
        onSubmit={(params) => actionTrigger.submitWithParams(params)}
      />
    ) : null;

  if (mode === "buttons") {
    return (
      <>
        <HStack align="center" gap="xs" flexShrink={0}>
          {actions.map((action) => {
            const icon = renderHeaderActionIcon(action.icon, "14px");

            if (action.presentation === "icon-button" && icon) {
              return (
                <Tooltip key={action.key} content={action.label}>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={action.label}
                    loading={actionTrigger.isActionPending(action.key)}
                    onClick={() => void actionTrigger.trigger(action.key)}
                  >
                    {icon}
                  </IconButton>
                </Tooltip>
              );
            }

            return (
              <Button
                key={action.key}
                size="sm"
                variant={getExtensionActionButtonVariant({ slotId, presentation: action.presentation })}
                loading={actionTrigger.isActionPending(action.key)}
                onClick={() => void actionTrigger.trigger(action.key)}
              >
                {icon}
                {action.label}
              </Button>
            );
          })}
        </HStack>
        {paramsDialog}
      </>
    );
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton size="sm" variant="ghost" aria-label="Extension actions">
            <MoreHorizontal size={16} />
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
                  icon={renderHeaderActionIcon(action.icon, "16px") ?? undefined}
                  onActivate={() => void actionTrigger.trigger(action.key)}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      {paramsDialog}
    </>
  );
};

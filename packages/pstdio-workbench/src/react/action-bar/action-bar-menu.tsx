import { IconButton } from "@chakra-ui/react";
import { ScopedMenu as Menu, Portal, type ResourceContextAction, ResourceMenuItems } from "@pstdio/ui";
import { useEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";
import type { NativeActionBarSnapshot } from "../../extensions/contributions/action-bar-snapshot";
import { WorkbenchShortcutHint } from "../keybindings/shortcut-hint";
import { WorkbenchIcon } from "../shared/icon";

type Action = Exclude<NativeActionBarSnapshot["items"][number], { items: unknown }>;
type ActionMenu = Extract<NativeActionBarSnapshot["items"][number], { items: unknown }>;
interface ActionBarMenuProps {
  item: ActionMenu;
  workbench: WorkbenchCore;
  horizontal: boolean;
  tabIndex: number;
  reorderShortcuts?: string;
  onFocus(): void;
  available(action: Action): boolean;
  run(action: Action): void;
}

export const ActionBarMenuButton = (props: ActionBarMenuProps) => {
  const { item, workbench, horizontal, tabIndex, reorderShortcuts, onFocus, available, run } = props;
  const pending = useRef<Action | undefined>(undefined);
  useEffect(
    () => () => {
      pending.current = undefined;
    },
    [],
  );
  const actions: ResourceContextAction[] = item.items.map((action) => ({
    key: action.id,
    label: action.label,
    icon: action.icon ? <WorkbenchIcon name={action.icon} /> : undefined,
    group: action.group ? { id: action.group } : undefined,
    isSelected: action.selected,
    isDisabled: !available(action),
    endContent: <WorkbenchShortcutHint workbench={workbench} action={action.action} includeLayers />,
    onSelect: () => {
      const target = action.action;
      if (target.kind === "command" && workbench.commands.getCommand(target.commandId)?.command.copyResultToClipboard) {
        run(action);
        return;
      }
      pending.current = action;
    },
  }));
  return (
    <Menu.Root
      lazyMount
      unmountOnExit
      positioning={{ placement: horizontal ? "bottom-start" : "right-start" }}
      onExitComplete={() => {
        const action = pending.current;
        pending.current = undefined;
        if (action) run(action);
      }}
    >
      <Menu.Trigger asChild>
        <IconButton
          aria-label={item.label}
          aria-keyshortcuts={reorderShortcuts}
          variant="ghost"
          size="xs"
          disabled={item.disabled}
          tabIndex={tabIndex}
          onFocus={onFocus}
        >
          <WorkbenchIcon name={item.icon ?? "Ellipsis"} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={item.label}>
            <ResourceMenuItems
              actions={actions}
              onSelect={(action) => {
                void action.onSelect?.();
              }}
            />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

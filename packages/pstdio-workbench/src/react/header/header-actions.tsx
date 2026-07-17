import { Button, HStack, IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, Tooltip } from "@pstdio/ui";
import { Fragment } from "react";
import {
  getAnchorResource,
  type MenuPath,
  type ResourceRef,
  type WorkbenchCommandExecutionContext,
  type WorkbenchCore,
} from "../../core";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import { listWorkbenchMenuItemsFromState, type WorkbenchMenuItem } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import {
  resolveWorkbenchAuxiliaryHeaderActionItems,
  resolveWorkbenchHeaderActionGroups,
  resolveWorkbenchHeaderOverflowLabel,
  resolveWorkbenchResourceActionItems,
  type WorkbenchHeaderOverflowItem,
} from "./header-action-items";

interface WorkbenchHeaderActionsProps {
  workbench: WorkbenchCore;
  menuPath: MenuPath;
}

const commandExecutionContext = (resource: ResourceRef | undefined): WorkbenchCommandExecutionContext | undefined =>
  resource ? { resource } : undefined;

const WorkbenchInlineHeaderAction = (props: {
  item: WorkbenchMenuItem;
  onSelect: (item: WorkbenchMenuItem) => void;
}) => {
  const { item, onSelect } = props;
  const onClick = () => onSelect(item);

  if (item.group === "primary" || !item.icon) {
    return (
      <Button
        key={item.id}
        size="xs"
        variant={item.group === "primary" ? "primary" : "subtle"}
        disabled={item.disabled}
        onClick={onClick}
      >
        {item.icon ? <WorkbenchIcon name={item.icon} size={14} /> : null}
        {item.label}
      </Button>
    );
  }

  return (
    <Tooltip key={item.id} content={item.label}>
      <IconButton size="xs" variant="ghost" aria-label={item.label} disabled={item.disabled} onClick={onClick}>
        <WorkbenchIcon name={item.icon} size={16} />
      </IconButton>
    </Tooltip>
  );
};

const useWorkbenchHeaderActionState = (workbench: WorkbenchCore, menuPath: MenuPath) => {
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const resource = useWorkbenchStore(workbench.layout.store, (state) =>
    getAnchorResource(state.frame, state.layout, "primary"),
  );
  const items = listWorkbenchMenuItemsFromState({ itemsByPath, commands, contextValues }, menuPath, { resource });

  // Actions whose command declares parameters collect that input through the shared
  // command params dialog before running; parameterless actions execute immediately.
  const onSelect = (item: WorkbenchMenuItem) => {
    const command = commands[item.commandId]?.command;
    const args = item.args;
    const context = commandExecutionContext(resource);
    if (command && hasCommandParameters(command.params)) {
      workbench.commandPalette.requestParams({ record: { command }, label: item.label, args, context });
      return;
    }
    void workbench.commands.executeCommand(item.commandId, args, context).catch(() => undefined);
  };

  return { items, onSelect };
};

interface WorkbenchHeaderActionMenuProps {
  items: WorkbenchHeaderOverflowItem[];
  label: string;
  triggerIcon: string;
  onSelect: (item: WorkbenchMenuItem) => void;
}

const WorkbenchHeaderActionMenu = (props: WorkbenchHeaderActionMenuProps) => {
  const { items, label, triggerIcon, onSelect } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label={label}>
          <WorkbenchIcon name={triggerIcon} size={16} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="220px" bg="bg">
            {items.map((item) => (
              <Fragment key={item.id}>
                {item.separatorBefore ? <Menu.Separator /> : null}
                <Menu.Item value={item.id} asChild>
                  <ListRow
                    asChild
                    variant="full-width"
                    id={item.id}
                    label={item.label}
                    icon={item.icon ? <WorkbenchIcon name={item.icon} size={16} /> : undefined}
                    disabled={item.disabled}
                    onActivate={() => onSelect(item)}
                  />
                </Menu.Item>
              </Fragment>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export const WorkbenchHeaderActions = (props: WorkbenchHeaderActionsProps) => {
  const { menuPath, workbench } = props;
  const { items, onSelect } = useWorkbenchHeaderActionState(workbench, menuPath);
  const { inlineItems, overflowItems } = resolveWorkbenchHeaderActionGroups(items);

  if (items.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {inlineItems.map((item) => (
        <WorkbenchInlineHeaderAction key={item.id} item={item} onSelect={onSelect} />
      ))}
      {overflowItems.length > 0 ? (
        <WorkbenchHeaderActionMenu
          items={overflowItems}
          label={resolveWorkbenchHeaderOverflowLabel(overflowItems)}
          triggerIcon="MoreHorizontal"
          onSelect={onSelect}
        />
      ) : null}
    </HStack>
  );
};

export const WorkbenchAuxiliaryHeaderActions = (props: WorkbenchHeaderActionsProps) => {
  const { menuPath, workbench } = props;
  const { items, onSelect } = useWorkbenchHeaderActionState(workbench, menuPath);
  const auxiliaryItems = resolveWorkbenchAuxiliaryHeaderActionItems(items);
  const { inlineItems, overflowItems } = resolveWorkbenchHeaderActionGroups(auxiliaryItems);

  if (auxiliaryItems.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {inlineItems.map((item) => (
        <WorkbenchInlineHeaderAction key={item.id} item={item} onSelect={onSelect} />
      ))}
      {overflowItems.length > 0 ? (
        <WorkbenchHeaderActionMenu
          items={overflowItems}
          label={resolveWorkbenchHeaderOverflowLabel(overflowItems)}
          triggerIcon="MoreHorizontal"
          onSelect={onSelect}
        />
      ) : null}
    </HStack>
  );
};

export const WorkbenchResourceActions = (props: WorkbenchHeaderActionsProps) => {
  const { menuPath, workbench } = props;
  const { items, onSelect } = useWorkbenchHeaderActionState(workbench, menuPath);
  const menuItems = resolveWorkbenchResourceActionItems(items);
  if (menuItems.length === 0) return null;

  return (
    <WorkbenchHeaderActionMenu
      items={menuItems}
      label={resolveWorkbenchHeaderOverflowLabel(menuItems, "Resource actions")}
      triggerIcon="ChevronDown"
      onSelect={onSelect}
    />
  );
};

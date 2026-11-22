import { Button, HStack, IconButton } from "@chakra-ui/react";
import { ListRow, ScopedMenu as Menu, Portal, Tooltip } from "@pstdio/ui";
import { Fragment } from "react";
import {
  getAnchorResource,
  type MenuPath,
  type ResourceRef,
  type WorkbenchCommandExecutionContext,
  type WorkbenchCore,
  type WorkbenchWidgetPlacement,
} from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import { createMenuEndContent } from "../menus/command-menu-items";
import { listWorkbenchMenuItemsFromState, type WorkbenchMenuItem } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolveWorkbenchHeaderActionGroups, resolveWorkbenchHeaderOverflowLabel } from "./header-action-items";

interface WorkbenchHeaderActionsProps {
  workbench: WorkbenchCore;
  menuPath: MenuPath;
  controlSize?: "2xs" | "xs";
  placement?: WorkbenchWidgetPlacement;
  itemIds?: readonly string[];
  iconOnly?: boolean;
}

const commandExecutionContext = (resource: ResourceRef | undefined): WorkbenchCommandExecutionContext | undefined =>
  resource ? { resource } : undefined;

const WorkbenchInlineHeaderAction = (props: {
  item: WorkbenchMenuItem;
  onSelect: (item: WorkbenchMenuItem) => void;
  controlSize: "2xs" | "xs";
  iconOnly?: boolean;
}) => {
  const { controlSize, item, onSelect, iconOnly } = props;
  const onClick = () => onSelect(item);

  if (iconOnly)
    return (
      <Tooltip content={item.label}>
        <IconButton
          aria-label={item.label}
          size={controlSize}
          variant="ghost"
          disabled={item.disabled}
          onClick={onClick}
        >
          <WorkbenchIcon name={item.icon ?? "Circle"} size={14} />
        </IconButton>
      </Tooltip>
    );

  if (item.group === "primary" || !item.icon) {
    return (
      <Button
        key={item.id}
        size={controlSize}
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
      <IconButton size={controlSize} variant="ghost" aria-label={item.label} disabled={item.disabled} onClick={onClick}>
        <WorkbenchIcon name={item.icon} size={16} />
      </IconButton>
    </Tooltip>
  );
};

export const useWorkbenchHeaderItems = (
  workbench: WorkbenchCore,
  menuPath: MenuPath,
  placement?: WorkbenchWidgetPlacement,
) => {
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  // Command handlers can read the focused panel while the page's primary resource stays unchanged.
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const resource = placement ? placement.resource : getAnchorResource(layout, "primary");
  const items = listWorkbenchMenuItemsFromState({ itemsByPath, commands, contextValues }, menuPath, { resource });
  return { commands, resource, items };
};

export const WorkbenchHeaderActions = (props: WorkbenchHeaderActionsProps) => {
  const { controlSize = "xs", menuPath, workbench, placement } = props;
  const { commands, resource, items } = useWorkbenchHeaderItems(workbench, menuPath, placement);
  const filtered = props.itemIds ? items.filter((item) => props.itemIds!.includes(item.id)) : items;
  const { inlineItems, overflowItems } = resolveWorkbenchHeaderActionGroups(filtered);

  // Actions whose command declares parameters collect that input through the shared
  // command params dialog (opened via the command palette store) before running;
  // parameterless actions execute immediately.
  const onSelect = (item: WorkbenchMenuItem) => {
    const command = commands[item.commandId]?.command;
    const args = item.args;
    const context = commandExecutionContext(resource);
    if (command && hasCommandParameters(command.params)) {
      workbench.commandPalette.requestParams({ record: { command }, label: item.label, args, context });
      return;
    }
    void runUserAction(workbench, item.label, () => workbench.commands.executeCommand(item.commandId, args, context));
  };

  if (items.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {inlineItems.map((item) => (
        <WorkbenchInlineHeaderAction
          key={item.id}
          item={item}
          onSelect={onSelect}
          controlSize={controlSize}
          iconOnly={props.iconOnly}
        />
      ))}
      {overflowItems.length > 0 ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              size={controlSize}
              variant="ghost"
              aria-label={resolveWorkbenchHeaderOverflowLabel(overflowItems)}
            >
              <WorkbenchIcon name="MoreHorizontal" size={16} />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content minW="220px" bg="bg">
                {overflowItems.map((item) => (
                  <Fragment key={item.id}>
                    {item.separatorBefore ? <Menu.Separator /> : null}
                    <Menu.Item value={item.id} disabled={item.disabled} asChild>
                      <ListRow
                        asChild
                        variant="full-width"
                        id={item.id}
                        label={item.label}
                        icon={item.icon ? <WorkbenchIcon name={item.icon} size={16} /> : undefined}
                        disabled={item.disabled}
                        endContent={createMenuEndContent({ disabledReason: item.disabledReason })}
                        onActivate={() => onSelect(item)}
                      />
                    </Menu.Item>
                  </Fragment>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      ) : null}
    </HStack>
  );
};

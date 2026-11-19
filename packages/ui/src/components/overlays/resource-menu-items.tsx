import { HStack, Icon } from "@chakra-ui/react";
import { Check, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { ScopedMenu as Menu } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { ListRow } from "../list-row/list-row";
import type { ResourceContextAction } from "./resource-context-menu";

interface ResourceMenuItemsProps {
  actions: ResourceContextAction[];
  onSelect(action: ResourceContextAction): void;
}
const ResourceMenuItem = (props: { action: ResourceContextAction; onSelect: ResourceMenuItemsProps["onSelect"] }) => {
  const { action, onSelect } = props;
  if (action.items && !action.isDisabled)
    return (
      <Menu.Root positioning={{ placement: "right-start", gutter: 2 }} closeOnSelect={false}>
        <Menu.TriggerItem asChild>
          <ListRow
            asChild
            variant="full-width"
            label={action.label}
            icon={action.icon}
            endContent={<ChevronRight size={14} />}
          />
        </Menu.TriggerItem>
        <ResourceSubmenu actions={action.items} onSelect={onSelect} />
      </Menu.Root>
    );
  const Item = action.group?.selectionMode === "single" ? Menu.RadioItem : Menu.Item;
  return (
    <Item
      value={action.key}
      disabled={action.isDisabled}
      closeOnSelect={action.closeOnSelect}
      onSelect={action.group?.selectionMode === "single" ? undefined : () => onSelect(action)}
      asChild
    >
      <ListRow
        asChild
        variant="full-width"
        label={action.label}
        icon={action.icon}
        endContent={
          action.isSelected ? (
            <HStack gap="xs">
              {action.endContent}
              <Icon as={Check} boxSize="3.5" />
            </HStack>
          ) : (
            action.endContent
          )
        }
        disabled={action.isDisabled}
      />
    </Item>
  );
};

export const ResourceMenuItems = (props: ResourceMenuItemsProps) => {
  const { actions, onSelect } = props;
  const groups = new Map<string, { label?: string; selectionMode?: "single"; actions: ResourceContextAction[] }>();
  for (const action of actions) {
    const id = action.group?.id ?? "ungrouped";
    const group = groups.get(id) ?? {
      label: action.group?.label,
      selectionMode: action.group?.selectionMode,
      actions: [],
    };
    if (action.group?.selectionMode === "single") group.selectionMode = "single";
    group.actions.push(action);
    groups.set(id, group);
  }
  return [...groups.entries()].map(([id, group], index) => (
    <Fragment key={id}>
      {index > 0 ? <Menu.Separator /> : null}
      <Menu.ItemGroup>
        {group.label ? <Menu.ItemGroupLabel>{group.label}</Menu.ItemGroupLabel> : null}
        {group.selectionMode === "single" ? (
          <Menu.RadioItemGroup
            aria-label={group.label}
            value={group.actions.find((action) => action.isSelected)?.key ?? ""}
            onValueChange={({ value }) => {
              const action = group.actions.find((action) => action.key === value);
              if (action && !action.isDisabled) onSelect(action);
            }}
          >
            {group.actions.map((action) => (
              <ResourceMenuItem key={action.key} action={action} onSelect={onSelect} />
            ))}
          </Menu.RadioItemGroup>
        ) : (
          group.actions.map((action, actionIndex) => (
            <Fragment key={action.key}>
              {action.separatorBefore && actionIndex > 0 ? <Menu.Separator /> : null}
              <ResourceMenuItem action={action} onSelect={onSelect} />
            </Fragment>
          ))
        )}
      </Menu.ItemGroup>
    </Fragment>
  ));
};

const ResourceSubmenu = (props: ResourceMenuItemsProps) => (
  <Portal>
    <Menu.Positioner>
      <Menu.Content>
        <ResourceMenuItems {...props} />
      </Menu.Content>
    </Menu.Positioner>
  </Portal>
);

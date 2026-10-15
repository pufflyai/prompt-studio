import { Box, Button, Menu, Portal, Text, useMenuContext } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { ListRow } from "../list-row/list-row";
import type { ResourceActionList, ResourceContextAction } from "./resource-context-menu";
import { SearchableMenuInput } from "./searchable-menu-input";
import { useResourceMenuList } from "./use-resource-menu-list";

interface ResourceMenuItemsProps {
  actions: ResourceContextAction[];
  onSelect(action: ResourceContextAction): void;
}
const ResourceMenuList = (props: { source: ResourceActionList; onSelect: ResourceMenuItemsProps["onSelect"] }) => {
  const { source, onSelect } = props;
  const [query, setQuery] = useState("");
  const viewport = useRef<HTMLDivElement | null>(null);
  const menu = useMenuContext();
  const state = useResourceMenuList(source, query);
  return (
    <Box>
      <SearchableMenuInput
        value={query}
        placeholder={source.searchLabel}
        onValueChange={(value) => {
          if (viewport.current) viewport.current.scrollTop = 0;
          setQuery(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && state.items[0]) {
            event.preventDefault();
            viewport.current?.closest<HTMLElement>('[role="menu"]')?.focus();
            menu.setHighlightedValue(state.items[0].key);
          }
        }}
      />
      <Box
        ref={viewport}
        layerStyle="resourceMenuList"
        overscrollBehavior="contain"
        role="group"
        aria-label={source.searchLabel}
        onScroll={(event) => {
          const node = event.currentTarget;
          if (!state.error && node.scrollHeight - node.scrollTop - node.clientHeight < node.clientHeight / 2)
            state.loadMore();
        }}
      >
        {state.items.map((action) => (
          <ResourceMenuItem key={action.key} action={action} onSelect={onSelect} />
        ))}
        {state.loading ? (
          <Text role="status" textStyle="label/S/regular" color="fg.muted" p="xs">
            {state.items.length ? "Loading more…" : "Loading…"}
          </Text>
        ) : null}
        {!state.loading && !state.error && state.items.length === 0 ? (
          <Text role="status" textStyle="label/S/regular" color="fg.muted" p="xs">
            {query ? "No matching results" : source.emptyLabel}
          </Text>
        ) : null}
        {state.error ? (
          <Box p="xs">
            <Text role="alert" textStyle="label/S/regular" color="fg.error">
              {state.error}
            </Text>
            <Button size="xs" variant="ghost" onClick={state.loadMore}>
              Retry
            </Button>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};
const ResourceMenuItem = (props: { action: ResourceContextAction; onSelect: ResourceMenuItemsProps["onSelect"] }) => {
  const { action, onSelect } = props;
  if (action.list) return <ResourceMenuList source={action.list} onSelect={onSelect} />;
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
  return (
    <Menu.Item value={action.key} disabled={action.isDisabled} closeOnSelect={action.closeOnSelect} asChild>
      <ListRow
        asChild
        variant="full-width"
        label={action.label}
        icon={action.icon}
        endContent={action.endContent}
        disabled={action.isDisabled}
        isSelected={action.isSelected}
        onActivate={() => onSelect(action)}
      />
    </Menu.Item>
  );
};

export const ResourceMenuItems = (props: ResourceMenuItemsProps) => {
  const { actions, onSelect } = props;
  const groups = new Map<string, { label?: string; actions: ResourceContextAction[] }>();
  for (const action of actions) {
    const id = action.group?.id ?? "ungrouped";
    const group = groups.get(id) ?? { label: action.group?.label, actions: [] };
    group.actions.push(action);
    groups.set(id, group);
  }
  return [...groups.entries()].map(([id, group], index) => (
    <Fragment key={id}>
      {index > 0 ? <Menu.Separator /> : null}
      <Menu.ItemGroup>
        {group.label ? <Menu.ItemGroupLabel>{group.label}</Menu.ItemGroupLabel> : null}
        {group.actions.map((action, actionIndex) => (
          <Fragment key={action.key}>
            {action.separatorBefore && actionIndex > 0 ? <Menu.Separator /> : null}
            <ResourceMenuItem action={action} onSelect={onSelect} />
          </Fragment>
        ))}
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

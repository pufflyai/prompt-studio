import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ListRow } from "@/components/list-row/list-row";
import { ResourceActionMenu } from "@/components/overlays/resource-context-menu";
import { SearchableMenu } from "@/components/overlays/searchable-menu";
import { Tooltip } from "@/components/primitives/tooltip";
import { ScopedMenu as Menu, ScopedPopover as Popover } from "./scoped-overlays";
import { Portal, UiScopeProvider, UiScopeRoot } from "./ui-scope";

const TriggerToggles = () => {
  const [open, setOpen] = useState(false);
  return (
    <UiScopeProvider active>
      <UiScopeRoot>
        <Stack align="start">
          <Menu.Root>
            <Menu.Trigger asChild>
              <Button id="menu-button">Menu with an ID</Button>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="action">Menu action</Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
          <Menu.Root>
            <Tooltip content="Open or close actions">
              <Menu.Trigger asChild>
                <Button>Menu with a tooltip</Button>
              </Menu.Trigger>
            </Tooltip>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="action">Tooltip menu action</Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button id="bare-popover-button">Uncontrolled popover</Button>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content aria-label="Uncontrolled details">
                  <Popover.Body>Uncontrolled details</Popover.Body>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
          <Popover.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
            <Tooltip content="Open or close details">
              <Popover.Trigger asChild>
                <Button id="popover-button">Popover with an ID</Button>
              </Popover.Trigger>
            </Tooltip>
            <Portal>
              <Popover.Positioner>
                <Popover.Content aria-label="Details">
                  <Popover.Body>Popover details</Popover.Body>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
          <SearchableMenu
            trigger={<ListRow role="button" id="search-trigger" label="Searchable menu" />}
            items={[{ id: "action", label: "Search result" }]}
            searchPlaceholder="Search actions"
            emptyState="No actions"
          />
          <ResourceActionMenu actions={[{ key: "action", label: "Resource action" }]}>
            <Button id="resource-trigger">Resource actions</Button>
          </ResourceActionMenu>
          <ListRow id="row-menu" label="Row menu" menuItems={[{ id: "action", label: "Row action" }]} />
          <Button>Outside</Button>
        </Stack>
      </UiScopeRoot>
    </UiScopeProvider>
  );
};

export default {
  title: "Design system/Components/Overlays/Trigger toggles",
  component: TriggerToggles,
  description: "Click a trigger to open its overlay. Click the same trigger again to close it.",
} satisfies CanvasMeta<typeof TriggerToggles>;

export const Buttons: CanvasFrame<typeof TriggerToggles> = {};

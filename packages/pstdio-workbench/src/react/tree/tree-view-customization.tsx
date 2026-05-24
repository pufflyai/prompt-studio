import { Box, Menu, Portal } from "@chakra-ui/react";
import type { TreeListSection } from "@pstdio/ui";
import {
  applyTreeListOrder,
  buildTreeVisibilityMenuActions,
  filterVisibleSections,
  ListRow,
  type ResourceContextAction,
  useTreeListOrderStore,
  useTreeListVisibilityStore,
} from "@pstdio/ui";
import { Check } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useState } from "react";

interface UseTreeViewCustomizationInput {
  enabled: boolean;
  storageKey?: string;
  sections: TreeListSection[];
}

interface UseTreeViewCustomizationOutput {
  visibleSections: TreeListSection[];
  draggable: boolean;
  onSectionContextMenu?: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
  onViewportContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onReorderSections?: (nextSectionIds: string[]) => void;
  onReorderNodes?: (sectionId: string, nextNodeIds: string[]) => void;
  menu: React.ReactNode;
}

const EMPTY_SNAPSHOT = {
  sectionOverrides: {} as Record<string, "hidden" | "shown">,
  nodeOverrides: {} as Record<string, "hidden" | "shown">,
};

const EMPTY_ORDER = { sectionOrder: [] as string[], nodeOrderBySection: {} as Record<string, string[]> };

const NULL_ANCHOR = { x: 0, y: 0 };

export const useTreeViewCustomization = (input: UseTreeViewCustomizationInput): UseTreeViewCustomizationOutput => {
  const { enabled, storageKey, sections } = input;
  const active = enabled && Boolean(storageKey);
  const key = storageKey ?? "__noop__";

  const visibility = useTreeListVisibilityStore(key, (state) => state);
  const order = useTreeListOrderStore(key, (state) => state);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState(NULL_ANCHOR);

  if (!active) {
    return { visibleSections: sections, draggable: false, menu: null };
  }

  const overrides = active ? visibility : EMPTY_SNAPSHOT;
  const savedOrder = active ? order : EMPTY_ORDER;

  const ordered = applyTreeListOrder(sections, savedOrder.sectionOrder, savedOrder.nodeOrderBySection);
  const visibleSections = filterVisibleSections(ordered, overrides.sectionOverrides, overrides.nodeOverrides);

  const openMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    setAnchor({ x: event.clientX, y: event.clientY });
    setMenuOpen(true);
  };

  const onSectionContextMenu = (event: ReactMouseEvent<HTMLElement>) => openMenu(event);
  const onViewportContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => openMenu(event);

  const onReorderSections = (nextSectionIds: string[]) => order.setSectionOrder(nextSectionIds);
  const onReorderNodes = (sectionId: string, nextNodeIds: string[]) => order.setNodeOrder(sectionId, nextNodeIds);

  const actions: ResourceContextAction[] = buildTreeVisibilityMenuActions(
    sections,
    overrides.sectionOverrides,
    overrides.nodeOverrides,
    {
      onToggleSection: (id, hiddenByDefault) => visibility.toggleSection(id, hiddenByDefault),
      onToggleNode: (id, hiddenByDefault) => visibility.toggleNode(id, hiddenByDefault),
      onResetAll: () => visibility.reset(),
      onResetOrder: () => order.reset(),
    },
    { checkmark: <Check size={14} /> },
  );

  const menu = (
    <Menu.Root
      open={menuOpen}
      onOpenChange={(details) => setMenuOpen(details.open)}
      positioning={{
        placement: "bottom-start",
        getAnchorRect: () => ({ x: anchor.x, y: anchor.y, width: 0, height: 0 }),
      }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="220px" bg="bg">
            {actions.map((action) => (
              <Menu.Item key={action.key} value={action.key} asChild>
                <ListRow
                  asChild
                  variant="compact"
                  label={action.label}
                  icon={action.icon}
                  endContent={action.endContent}
                  disabled={action.isDisabled}
                  onActivate={action.onClick}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );

  return {
    visibleSections,
    draggable: true,
    onSectionContextMenu,
    onViewportContextMenu,
    onReorderSections,
    onReorderNodes,
    menu: <Box display="contents">{menu}</Box>,
  };
};

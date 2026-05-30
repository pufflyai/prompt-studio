import { Box, HStack, IconButton, Menu, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import type { FocusEventHandler, MouseEvent as ReactMouseEvent } from "react";
import { SearchableActionMenu } from "../list-row/searchable-action-menu";
import type { TreeListAction, TreeListSection } from "./tree-list.types";

interface TreeListSectionActionsProps {
  sectionId: string;
  actions: TreeListAction[];
}

const TreeListSectionActions = (props: TreeListSectionActionsProps) => {
  const { sectionId, actions } = props;
  if (actions.length === 0) return null;

  return (
    <HStack
      gap="0"
      opacity="0"
      pointerEvents="none"
      _groupHover={{ opacity: "1", pointerEvents: "auto" }}
      _groupFocusWithin={{ opacity: "1", pointerEvents: "auto" }}
      transition="opacity 120ms ease"
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action) => {
        if (action.menuItems && action.menuItems.length >= 8) {
          return <SearchableActionMenu key={action.id} action={action} />;
        }
        if (action.menuItems && action.menuItems.length > 0) {
          return (
            <Menu.Root key={action.id}>
              <Menu.Trigger asChild>
                <IconButton variant="ghost" size="2xs" aria-label={action.label}>
                  {action.icon}
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content minW="160px" bg="bg">
                  {action.menuItems.map((item) => (
                    <Menu.Item key={item.id} value={item.id} disabled={item.disabled} onClick={() => item.onAction?.()}>
                      {item.label}
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          );
        }
        return (
          <IconButton
            key={action.id}
            variant="ghost"
            size="2xs"
            aria-label={action.label}
            onClick={(event) => {
              event.stopPropagation();
              action.onAction?.({ sectionId });
            }}
          >
            {action.icon}
          </IconButton>
        );
      })}
    </HStack>
  );
};

interface TreeListSectionHeaderProps {
  section: TreeListSection;
  collapsible: boolean;
  expanded: boolean;
  focusId: string;
  tabIndex: number;
  onFocus: FocusEventHandler<HTMLElement>;
  onToggle: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
}

export const TreeListSectionHeader = (props: TreeListSectionHeaderProps) => {
  const { section, collapsible, expanded, focusId, tabIndex, onFocus, onToggle, onContextMenu } = props;

  return (
    <HStack
      className="group"
      justify="space-between"
      align="center"
      w="full"
      minW="0"
      maxW="full"
      px="sm"
      py="2xs"
      height="7"
      cursor={collapsible ? "pointer" : "default"}
      tabIndex={collapsible ? tabIndex : undefined}
      data-tree-list-focus-id={collapsible ? focusId : undefined}
      aria-expanded={collapsible ? expanded : undefined}
      _hover={collapsible ? { bg: "bg.hover" } : undefined}
      _focusVisible={collapsible ? { bg: "bg.hover" } : undefined}
      onFocus={collapsible ? onFocus : undefined}
      onClick={collapsible ? onToggle : undefined}
      onContextMenu={
        onContextMenu
          ? (event) => {
              event.preventDefault();
              onContextMenu(event, section.id);
            }
          : undefined
      }
    >
      <HStack gap="1" flex="1" minW="0">
        <Text textStyle="label/XS" textTransform="uppercase" color="fg.muted" letterSpacing="0.08em" truncate>
          {section.label}
        </Text>
        {collapsible ? (
          <Box color="fg.muted" flexShrink={0}>
            <ChevronRight
              size={14}
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "120ms" }}
            />
          </Box>
        ) : null}
      </HStack>
      <TreeListSectionActions sectionId={section.id} actions={section.actions ?? []} />
    </HStack>
  );
};

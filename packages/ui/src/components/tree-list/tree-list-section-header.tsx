import { Box, HStack, Text, useRecipe } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import type { FocusEventHandler, MouseEvent as ReactMouseEvent } from "react";
import { ActionIconButton } from "../list-row/action-icon-button";
import { createResourceContextActions } from "../list-row/list-row-chrome";
import { SearchableActionMenu } from "../list-row/searchable-action-menu";
import { ResourceActionMenu, ResourceContextMenu } from "../overlays/resource-context-menu";
import type { TreeListAction, TreeListSection } from "./tree-list.types";
import { TreeListInlineInputRow } from "./tree-list-inline-input";

interface TreeListSectionActionsProps {
  sectionId: string;
  actions: TreeListAction[];
}

const TreeListSectionActions = (props: TreeListSectionActionsProps) => {
  const { sectionId, actions } = props;
  const accessory = useRecipe({ key: "listRowAccessory" });
  if (actions.length === 0) return null;

  return (
    <HStack gap="0" css={accessory({ visibility: "hover" })} onClick={(event) => event.stopPropagation()}>
      {actions.map((action) => {
        if (action.menuItems && action.menuItems.length >= 8) {
          return <SearchableActionMenu key={action.id} action={action} />;
        }
        if (action.menuItems && action.menuItems.length > 0) {
          return (
            <ResourceActionMenu key={action.id} actions={createResourceContextActions(action.menuItems)}>
              <ActionIconButton
                tooltip={action.tooltip ?? action.label}
                variant="ghost"
                size="2xs"
                aria-label={action.label}
              >
                {action.icon}
              </ActionIconButton>
            </ResourceActionMenu>
          );
        }
        return (
          <ActionIconButton
            key={action.id}
            tooltip={action.tooltip ?? action.label}
            variant="ghost"
            size="2xs"
            aria-label={action.label}
            onClick={(event) => {
              event.stopPropagation();
              action.onAction?.({ sectionId });
            }}
          >
            {action.icon}
          </ActionIconButton>
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
  const chevron = useRecipe({ key: "treeChevron" });

  if (section.inlineInput) {
    return <TreeListInlineInputRow input={section.inlineInput} level={0} />;
  }

  const contextActions = createResourceContextActions(section.contextMenuItems ?? []);

  return (
    <ResourceContextMenu actions={contextActions}>
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
          {section.icon}
          <Text textStyle="label/XS" textTransform="uppercase" color="fg.muted" letterSpacing="0.08em" truncate>
            {section.label}
          </Text>
          {collapsible ? (
            <Box color="fg.muted" flexShrink={0}>
              <Box asChild css={chevron()} data-open={expanded}>
                <ChevronRight size={14} />
              </Box>
            </Box>
          ) : null}
        </HStack>
        <TreeListSectionActions sectionId={section.id} actions={section.actions ?? []} />
      </HStack>
    </ResourceContextMenu>
  );
};

import { Box, HStack, IconButton, Menu, Stack, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { Tooltip } from "../tooltip";
import { SearchableActionMenu } from "./searchable-action-menu";
import type {
  SidebarAction,
  SidebarLinkComponent,
  SidebarNavigateEvent,
  SidebarNode,
  SidebarSection,
} from "./sidebar-tree.types";

interface SidebarTreeProps {
  sections: SidebarSection[];
  expandedSections: string[];
  expandedNodes: string[];
  activeNodeId?: string | null;
  linkComponent?: SidebarLinkComponent;
  onNavigate?: (event: SidebarNavigateEvent) => void;
  onToggleSection: (sectionId: string) => void;
  onToggleNode: (nodeId: string) => void;
}

interface SidebarRowActionsProps {
  sectionId: string;
  nodeId?: string;
  actions: SidebarAction[];
}

interface SidebarNodeRowProps {
  sectionId: string;
  node: SidebarNode;
  level: number;
  expandedNodes: string[];
  activeNodeId?: string | null;
  linkComponent?: SidebarLinkComponent;
  onNavigate?: (event: SidebarNavigateEvent) => void;
  onToggleNode: (nodeId: string) => void;
}

const isExpanded = (id: string, values: string[]) => values.includes(id);

const SidebarActionButton = (props: { action: SidebarAction; sectionId: string; nodeId?: string }) => {
  const { action, sectionId, nodeId } = props;

  if (action.menuItems && action.menuItems.length > 0) {
    if (action.menuItems.length >= 8) {
      return <SearchableActionMenu action={action} />;
    }

    return (
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton variant="ghost" size="2xs" aria-label={action.label}>
            {action.icon}
          </IconButton>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content minW="160px" bg="bg">
            {action.menuItems.map((item) => (
              <Tooltip key={item.id} content={item.description} disabled={!item.description} openDelay={300}>
                <Menu.Item value={item.id} onClick={() => item.onAction?.()}>
                  {item.icon ? <Box mr="2">{item.icon}</Box> : null}
                  {item.label}
                </Menu.Item>
              </Tooltip>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    );
  }

  return (
    <IconButton
      variant="ghost"
      size="2xs"
      aria-label={action.label}
      onClick={(event) => {
        event.stopPropagation();
        action.onAction?.({ sectionId, nodeId });
      }}
    >
      {action.icon}
    </IconButton>
  );
};

const SidebarRowActions = (props: SidebarRowActionsProps) => {
  const { sectionId, nodeId, actions } = props;

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
      {actions.map((action) => (
        <SidebarActionButton key={action.id} action={action} sectionId={sectionId} nodeId={nodeId} />
      ))}
    </HStack>
  );
};

const SidebarNodeRow = (props: SidebarNodeRowProps) => {
  const {
    sectionId,
    node,
    level,
    expandedNodes,
    activeNodeId,
    linkComponent: LinkComponent,
    onNavigate,
    onToggleNode,
  } = props;
  const hasChildren = (node.children?.length ?? 0) > 0;
  const expanded = hasChildren && isExpanded(node.id, expandedNodes);
  const isNavigable = node.isNavigable || node.navigationIntent !== undefined;
  const isActive = activeNodeId === node.id;
  const isDisabled = node.disabled === true;
  const paddingLeft = level > 0 ? `calc(var(--chakra-spacing-1) + ${level} * var(--chakra-spacing-3))` : undefined;
  const canLink = Boolean(LinkComponent && node.href && isNavigable && !hasChildren && !isDisabled);

  const handleClick = () => {
    if (isDisabled) return;

    if (hasChildren) {
      onToggleNode(node.id);
      return;
    }

    if (!isNavigable) return;

    onNavigate?.({
      sectionId,
      nodeId: node.id,
      node,
      intent: node.navigationIntent,
    });
  };

  const rowContent = (
    <HStack gap="2" minW="0" flex="1" overflow="hidden">
      {node.icon ? (
        <Box color={node.iconColor ?? "fg.muted"} flexShrink={0}>
          {node.icon}
        </Box>
      ) : null}
      <Stack gap="0" minW="0" flex="1">
        <HStack gap="1" minW="0">
          <Text textStyle="paragraph/S/regular" color={isDisabled ? "fg.muted" : "fg"} truncate>
            {node.label}
          </Text>
          {node.indicator ? (
            <Tooltip content={node.indicator.tooltip} disabled={!node.indicator.tooltip} openDelay={300}>
              <Box color={node.indicator.color ?? "fg.muted"} flexShrink={0}>
                {node.indicator.icon}
              </Box>
            </Tooltip>
          ) : null}
          {hasChildren ? (
            <Box color="fg.muted" flexShrink={0}>
              <ChevronRight
                size={14}
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "120ms" }}
              />
            </Box>
          ) : null}
        </HStack>
        {node.description ? (
          <Text textStyle="paragraph/XS/regular" color="fg.muted" truncate>
            {node.description}
          </Text>
        ) : null}
      </Stack>
    </HStack>
  );

  const rowStyles = {
    className: "group",
    role: "option" as const,
    "aria-selected": isActive,
    justify: "space-between" as const,
    align: "center" as const,
    w: "full",
    minW: "0",
    maxW: "full",
    borderRadius: "xs",
    px: "1",
    py: "2xs",
    pl: paddingLeft,
    bg: isActive ? "bg.active" : "transparent",
    _hover: { bg: isActive ? "bg.active" : "bg.hover" },
    cursor: isDisabled ? ("default" as const) : ("pointer" as const),
    overflow: "hidden" as const,
  };

  return (
    <Stack gap="1px" w="full" minW="0" maxW="full">
      {canLink && LinkComponent && node.href ? (
        <LinkComponent to={node.href}>
          <HStack {...rowStyles} onClick={handleClick}>
            {rowContent}
            <SidebarRowActions sectionId={sectionId} nodeId={node.id} actions={node.actions ?? []} />
          </HStack>
        </LinkComponent>
      ) : (
        <HStack {...rowStyles} onClick={handleClick}>
          {rowContent}
          <SidebarRowActions sectionId={sectionId} nodeId={node.id} actions={node.actions ?? []} />
        </HStack>
      )}

      {expanded
        ? node.children?.map((childNode) => (
            <SidebarNodeRow
              key={childNode.id}
              sectionId={sectionId}
              node={childNode}
              level={level + 1}
              expandedNodes={expandedNodes}
              activeNodeId={activeNodeId}
              linkComponent={LinkComponent}
              onNavigate={onNavigate}
              onToggleNode={onToggleNode}
            />
          ))
        : null}
    </Stack>
  );
};

interface SidebarSectionHeaderProps {
  section: SidebarSection;
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
}

const SidebarSectionHeader = (props: SidebarSectionHeaderProps) => {
  const { section, collapsible, expanded, onToggle } = props;

  return (
    <HStack
      className="group"
      justify="space-between"
      align="center"
      w="full"
      minW="0"
      maxW="full"
      px="1"
      py="2xs"
      minH="7"
      cursor={collapsible ? "pointer" : "default"}
      borderRadius="xs"
      _hover={collapsible ? { bg: "bg.hover" } : undefined}
      onClick={collapsible ? onToggle : undefined}
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
      <SidebarRowActions sectionId={section.id} actions={section.actions ?? []} />
    </HStack>
  );
};

export const SidebarTree = (props: SidebarTreeProps) => {
  const {
    sections,
    expandedSections,
    expandedNodes,
    activeNodeId,
    linkComponent,
    onNavigate,
    onToggleSection,
    onToggleNode,
  } = props;

  return (
    <Stack role="listbox" gap="md" w="full" minW="0" maxW="full" overflowX="hidden">
      {sections.map((section) => {
        const collapsible = section.collapsible !== false && section.label !== undefined;
        const sectionExpanded = collapsible ? isExpanded(section.id, expandedSections) : true;

        return (
          <Stack key={section.id} gap="0" w="full" minW="0" maxW="full" data-testid={`sidebar-section-${section.id}`}>
            {section.label ? (
              <SidebarSectionHeader
                section={section}
                collapsible={collapsible}
                expanded={sectionExpanded}
                onToggle={() => onToggleSection(section.id)}
              />
            ) : null}

            {sectionExpanded ? (
              section.nodes.length > 0 ? (
                <Stack gap="1px" w="full" minW="0" maxW="full">
                  {section.nodes.map((node) => (
                    <SidebarNodeRow
                      key={node.id}
                      sectionId={section.id}
                      node={node}
                      level={0}
                      expandedNodes={expandedNodes}
                      activeNodeId={activeNodeId}
                      linkComponent={linkComponent}
                      onNavigate={onNavigate}
                      onToggleNode={onToggleNode}
                    />
                  ))}
                </Stack>
              ) : (
                (section.emptyState ?? null)
              )
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
};

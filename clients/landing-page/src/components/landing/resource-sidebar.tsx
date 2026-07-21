import { Badge, Box, HStack, Kbd, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { ListRow, TreeList, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import { ArrowUpRight, Bell, ChevronRight, CircleHelp, GitBranch, Github, MessagesSquare, Search } from "lucide-react";
import { useRef, useState } from "react";
import {
  type LandingView,
  NAVIGATION_GROUP_META,
  type NavigationGroupId,
  SITE_LINKS,
  VIEW_META,
} from "./landing-content";

const EXTERNAL_NODES: Record<string, { label: string; icon: typeof Github; url: string }> = {
  github: { label: "GitHub", icon: Github, url: SITE_LINKS.github },
  discord: { label: "Discord", icon: MessagesSquare, url: SITE_LINKS.discord },
};

const viewNode = (view: LandingView, label?: string): TreeListNode => {
  const meta = VIEW_META[view];
  return {
    id: view,
    label: label ?? meta.label,
    icon: <meta.icon size={14} />,
    isNavigable: true,
  };
};

// container rows toggle on click (workbench tree semantics)
const groupNode = (group: NavigationGroupId, children: LandingView[]): TreeListNode => {
  const meta = NAVIGATION_GROUP_META[group];
  return {
    id: `${group}-group`,
    label: meta.label,
    icon: <meta.icon size={14} />,
    children: [
      ...(meta.overview ? [viewNode(meta.overview, "Overview")] : []),
      ...children.map((child) => viewNode(child)),
    ],
  };
};

const externalNode = (id: keyof typeof EXTERNAL_NODES): TreeListNode => {
  const entry = EXTERNAL_NODES[id];
  return {
    id,
    label: entry.label,
    icon: <entry.icon size={14} />,
    endContent: <ArrowUpRight size={12} />,
    isNavigable: true,
  };
};

// Keep the routes available while the documentation group is hidden from navigation.
const SHOW_DOCUMENTATION = false;

const SIDEBAR_SECTIONS: TreeListSection[] = [
  {
    id: "explore",
    label: NAVIGATION_GROUP_META.explore.label,
    nodes: [viewNode("start"), viewNode("why-prompt-studio"), viewNode("gallery")],
  },
  ...(SHOW_DOCUMENTATION
    ? [
        {
          id: "documentation",
          label: "Documentation",
          nodes: [
            viewNode("concepts"),
            groupNode("guides", [
              "guide-getting-started",
              "guide-create-ticket",
              "guide-implement-ticket",
              "guide-create-proposal",
              "guide-create-sub-tickets",
              "guide-refine-ticket",
              "guide-create-extension",
            ]),
            groupNode("cli-reference", [
              "cli-projects",
              "cli-workspaces",
              "cli-agents",
              "cli-sessions",
              "cli-extensions",
              "cli-planner",
              "cli-configuration",
            ]),
            groupNode("sdk-reference", ["sdk-commands", "sdk-views", "sdk-hooks", "sdk-client", "sdk-assets"]),
          ],
        },
      ]
    : []),
  { id: "blog", label: "Blog", nodes: [viewNode("blog", "All posts")] },
  { id: "links", label: "Links", nodes: [externalNode("github"), externalNode("discord")] },
];

const MIN_WIDTH = 160;
const MAX_WIDTH = 320;
const CLOSE_THRESHOLD = 120;

const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

interface ResourceSidebarProps {
  width: number;
  activeView: LandingView;
  unreadCount: number;
  onResize: (width: number) => void;
  onClose: () => void;
  onNavigate: (view: LandingView) => void;
  onOpenPalette: () => void;
  onOpenNotifications: () => void;
  onOpenChangelog: () => void;
}

export const ResourceSidebar = (props: ResourceSidebarProps) => {
  const {
    width,
    activeView,
    unreadCount,
    onResize,
    onClose,
    onNavigate,
    onOpenPalette,
    onOpenNotifications,
    onOpenChangelog,
  } = props;

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [expandedSectionIds, setExpandedSectionIds] = useState(SIDEBAR_SECTIONS.map((section) => section.id));
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // stop the drag from selecting page text
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: width };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nextWidth = drag.startWidth + event.clientX - drag.startX;
    if (nextWidth < CLOSE_THRESHOLD) {
      dragRef.current = null;
      onResize(drag.startWidth);
      onClose();
      return;
    }
    onResize(Math.min(Math.max(nextWidth, MIN_WIDTH), MAX_WIDTH));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleNavigate = (event: { nodeId: string }) => {
    const external = EXTERNAL_NODES[event.nodeId];
    if (external) {
      window.open(external.url, "_blank", "noopener");
      return;
    }
    onNavigate(event.nodeId as LandingView);
  };

  return (
    <Stack
      width={`${width}px`}
      flexShrink="0"
      gap="0"
      position="relative"
      bg="bg.subtle"
      borderRightWidth="1px"
      borderColor="border"
      display={{ base: "none", lg: "flex" }}
    >
      <Box
        position="absolute"
        top="0"
        right="-3px"
        width="6px"
        height="100%"
        cursor="col-resize"
        zIndex="1"
        _hover={{ bg: "border" }}
        _active={{ bg: "border" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <Stack gap="1px" pt="8px" pb="6px" px="10px" borderBottomWidth="1px" borderColor="border">
        <ListRow
          variant="compact"
          icon={<Search size={14} />}
          label="Search"
          endContent={<Kbd size="sm">⌘K</Kbd>}
          onClick={onOpenPalette}
        />
        <ListRow
          variant="compact"
          icon={<Bell size={14} />}
          label="Notifications"
          endContent={
            unreadCount > 0 ? (
              <Badge size="xs" colorPalette="blue" rounded="full">
                {unreadCount}
              </Badge>
            ) : undefined
          }
          onClick={onOpenNotifications}
        />
      </Stack>
      <Box flex="1" overflowY="auto" py="6px">
        <TreeList
          sections={SIDEBAR_SECTIONS}
          rowVariant="compact"
          activeNodeId={activeView}
          expandedSectionIds={expandedSectionIds}
          expandedNodeIds={expandedNodeIds}
          onNavigate={handleNavigate}
          onToggleSection={(sectionId) => setExpandedSectionIds((ids) => toggleId(ids, sectionId))}
          onToggleNode={(nodeId) => setExpandedNodeIds((ids) => toggleId(ids, nodeId))}
        />
      </Box>
      <Stack gap="1px" p="10px" pt="6px" borderTopWidth="1px" borderColor="border">
        <ListRow variant="compact" icon={<GitBranch size={14} />} label="Changelog" onClick={onOpenChangelog} />
        <Menu.Root lazyMount closeOnSelect positioning={{ placement: "top-start" }}>
          <Menu.Trigger asChild>
            {/* ListRow renders its own button and swallows the trigger's anchor ref, so mirror the compact row */}
            <HStack
              as="button"
              width="100%"
              height="1.75rem"
              px="sm"
              gap="xs"
              rounded="xs"
              cursor="pointer"
              _hover={{ bg: "bg.hover" }}
            >
              <CircleHelp size={14} />
              <Text fontFamily="body" fontSize="sm" flex="1" textAlign="left">
                Help
              </Text>
              <Box display="flex" color="fg.subtle">
                <ChevronRight size={12} />
              </Box>
            </HStack>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content minW="12rem">
                {(["privacy", "terms"] as const).map((view) => {
                  const meta = VIEW_META[view];
                  return (
                    <Menu.Item key={view} value={view} asChild>
                      <ListRow
                        variant="full-width"
                        icon={<meta.icon size={14} />}
                        label={meta.label}
                        onClick={() => onNavigate(view)}
                      />
                    </Menu.Item>
                  );
                })}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </Stack>
    </Stack>
  );
};

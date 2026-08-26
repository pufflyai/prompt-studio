import { Box, Stack } from "@chakra-ui/react";
import { TreeList, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import { ArrowUpRight, BookOpen, FileText, Folder, Github, MessagesSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type LandingView, NAVIGATION_GROUP_META, SITE_LINKS, VIEW_META } from "./landing-content";
import { REPOSITORY_DOC_TREE, type RepositoryDocTreeNode } from "./repository-docs";

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

const repositoryNode = (node: RepositoryDocTreeNode): TreeListNode => {
  const isFolder = Boolean(node.children?.length);
  return {
    id: node.id,
    label: node.label,
    icon: isFolder ? <Folder size={14} /> : <FileText size={14} />,
    children: node.children?.map(repositoryNode),
    isNavigable: Boolean(node.path),
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

const SIDEBAR_SECTIONS: TreeListSection[] = [
  {
    id: "explore",
    label: NAVIGATION_GROUP_META.explore.label,
    nodes: [
      viewNode("start"),
      viewNode("guide-getting-started", "CLI quickstart"),
      viewNode("sdk-reference"),
      viewNode("gallery"),
    ],
  },
  {
    id: "documentation",
    label: "Documentation",
    nodes: [
      {
        id: "doc:index.md",
        label: "Overview",
        icon: <BookOpen size={14} />,
        isNavigable: true,
      },
      ...REPOSITORY_DOC_TREE.map(repositoryNode),
    ],
  },
  { id: "links", label: "Links", nodes: [externalNode("github"), externalNode("discord")] },
];

const MIN_WIDTH = 160;
const MAX_WIDTH = 320;
const CLOSE_THRESHOLD = 120;

const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

const folderIdsForPath = (path?: string) => {
  const segments = path?.split("/").slice(0, -1) ?? [];
  return segments.map((_, index) => `doc-folder:${segments.slice(0, index + 1).join("/")}`);
};

interface ResourceSidebarProps {
  width: number;
  activeDocPath?: string;
  activeView: LandingView;
  onResize: (width: number) => void;
  onClose: () => void;
  onNavigate: (view: LandingView) => void;
  onNavigateDoc: (path: string) => void;
}

export const ResourceSidebar = (props: ResourceSidebarProps) => {
  const { width, activeDocPath, activeView, onResize, onClose, onNavigate, onNavigateDoc } = props;

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [expandedSectionIds, setExpandedSectionIds] = useState(SIDEBAR_SECTIONS.map((section) => section.id));
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>(() => folderIdsForPath(activeDocPath));

  useEffect(() => {
    const activeFolders = folderIdsForPath(activeDocPath);
    setExpandedNodeIds((ids) => [...new Set([...ids, ...activeFolders])]);
  }, [activeDocPath]);

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
    if (event.nodeId.startsWith("doc:")) {
      onNavigateDoc(event.nodeId.slice("doc:".length));
      return;
    }
    onNavigate(event.nodeId as LandingView);
  };

  const activeNodeId = activeView === "documentation" ? `doc:${activeDocPath ?? "index.md"}` : activeView;

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
      <Box flex="1" overflowY="auto" py="6px">
        <TreeList
          sections={SIDEBAR_SECTIONS}
          rowVariant="compact"
          activeNodeId={activeNodeId}
          expandedSectionIds={expandedSectionIds}
          expandedNodeIds={expandedNodeIds}
          onNavigate={handleNavigate}
          onToggleSection={(sectionId) => setExpandedSectionIds((ids) => toggleId(ids, sectionId))}
          onToggleNode={(nodeId) => setExpandedNodeIds((ids) => toggleId(ids, nodeId))}
        />
      </Box>
    </Stack>
  );
};

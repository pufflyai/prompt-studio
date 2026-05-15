import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { EllipsisVertical, FileText, Folder, Plus, Settings } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { TreeList } from "./tree-list";
import type { TreeListNavigateEvent, TreeListNode, TreeListSection } from "./tree-list.types";

const meta: Meta<typeof TreeList> = {
  title: "Components/TreeList",
  component: TreeList,
};

export default meta;
type Story = StoryObj<typeof TreeList>;

const toggleId = (ids: string[], id: string) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);

const actionMenuItems = Array.from({ length: 10 }, (_, index) => ({
  id: `action-${index + 1}`,
  label: `Action ${index + 1}`,
  description: `Run action ${index + 1}`,
}));

const navigationSections: TreeListSection[] = [
  {
    id: "docs",
    label: "Documentation",
    actions: [{ id: "add-doc", label: "Add document", icon: <Plus size={14} /> }],
    nodes: [
      {
        id: "overview",
        label: "Overview",
        icon: <FileText size={14} />,
        isNavigable: true,
        navigationIntent: { id: "open", payload: "overview" },
      },
      {
        id: "guides",
        label: "Guides",
        icon: <Folder size={14} />,
        children: [
          {
            id: "projects",
            label: "Projects",
            icon: <Folder size={14} />,
            children: [
              {
                id: "create-project",
                label: "Create a project",
                icon: <FileText size={14} />,
                isNavigable: true,
                navigationIntent: { id: "open", payload: "create-project" },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    nodes: [
      {
        id: "workspace",
        label: "Workspace",
        icon: <Settings size={14} />,
        isNavigable: true,
        actions: [
          { id: "more", label: "More actions", icon: <EllipsisVertical size={14} />, menuItems: actionMenuItems },
        ],
      },
    ],
  },
];

const fileSections: TreeListSection[] = [
  {
    id: "files",
    nodes: [
      {
        id: "src",
        label: "src",
        isContainer: true,
        children: [
          {
            id: "src/components",
            label: "components",
            isContainer: true,
            children: [
              {
                id: "src/components/tree-list.tsx",
                label: "tree-list.tsx",
                icon: <FileText size={14} />,
                onActivate: () => undefined,
              },
            ],
          },
          {
            id: "src/index.ts",
            label: "index.ts",
            icon: <FileText size={14} />,
            onActivate: () => undefined,
          },
        ],
      },
    ],
  },
];

const SectionedNavigationStory = () => {
  const [expandedSections, setExpandedSections] = useState(["docs", "settings"]);
  const [expandedNodes, setExpandedNodes] = useState(["guides", "projects"]);
  const [activeNodeId, setActiveNodeId] = useState("overview");
  const [lastEvent, setLastEvent] = useState("No navigation yet");

  const handleNavigate = (event: TreeListNavigateEvent) => {
    setActiveNodeId(event.nodeId);
    setLastEvent(`${event.sectionId}:${event.nodeId}`);
  };

  return (
    <Stack maxW="18rem" gap="md">
      <TreeList
        sections={navigationSections}
        expandedSectionIds={expandedSections}
        expandedNodeIds={expandedNodes}
        activeNodeId={activeNodeId}
        rowVariant="compact"
        sectionGap="md"
        nodeGap="1px"
        onNavigate={handleNavigate}
        onToggleSection={(id) => setExpandedSections((current) => toggleId(current, id))}
        onToggleNode={(id) => setExpandedNodes((current) => toggleId(current, id))}
      />
      <Box borderWidth="1px" p="sm">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {lastEvent}
        </Text>
      </Box>
    </Stack>
  );
};

const FileTreeStory = () => {
  const [expandedNodes, setExpandedNodes] = useState(["src", "src/components"]);
  const [activeNodeId, setActiveNodeId] = useState("src/components/tree-list.tsx");

  const sections = fileSections.map((section) => ({
    ...section,
    nodes: section.nodes.map((node) => ({
      ...node,
      children: node.children?.map((child) => ({
        ...child,
        children: child.children?.map((file) => ({
          ...file,
          onActivate: () => setActiveNodeId(file.id ?? ""),
        })),
      })),
    })),
  })) as TreeListSection[];

  return (
    <Stack maxW="20rem" borderWidth="1px" p="xs">
      <TreeList
        sections={sections}
        expandedNodeIds={expandedNodes}
        activeNodeId={activeNodeId}
        rowVariant="tree"
        onToggleNode={(id) => setExpandedNodes((current) => toggleId(current, id))}
      />
    </Stack>
  );
};

const buildLargeTreeSections = (groups: number, leavesPerBranch: number, branchesPerGroup: number) => {
  const sections: TreeListSection[] = [];
  for (let groupIndex = 0; groupIndex < groups; groupIndex += 1) {
    const groupId = `group-${groupIndex}`;
    const nodes: TreeListNode[] = [];
    for (let branchIndex = 0; branchIndex < branchesPerGroup; branchIndex += 1) {
      const branchId = `${groupId}/branch-${branchIndex}`;
      const leaves: TreeListNode[] = [];
      for (let leafIndex = 0; leafIndex < leavesPerBranch; leafIndex += 1) {
        const leafId = `${branchId}/leaf-${leafIndex}`;
        leaves.push({
          id: leafId,
          label: `Leaf ${groupIndex}.${branchIndex}.${leafIndex}`,
          icon: <FileText size={14} />,
          isNavigable: true,
          navigationIntent: { id: "open", payload: leafId },
        });
      }
      nodes.push({
        id: branchId,
        label: `Branch ${groupIndex}.${branchIndex}`,
        icon: <Folder size={14} />,
        isContainer: true,
        children: leaves,
      });
    }
    sections.push({
      id: groupId,
      label: `Group ${groupIndex}`,
      nodes,
    });
  }
  return sections;
};

const LARGE_TREE_GROUPS = 20;
const LARGE_TREE_BRANCHES_PER_GROUP = 10;
const LARGE_TREE_LEAVES_PER_BRANCH = 25;

const collectExpandableIds = (sections: TreeListSection[]) => {
  const sectionIds: string[] = [];
  const nodeIds: string[] = [];

  const walk = (nodes: TreeListNode[]) => {
    for (const node of nodes) {
      const children = (node.children ?? []) as TreeListNode[];
      if (children.length > 0 || node.isContainer) nodeIds.push(node.id);
      if (children.length > 0) walk(children);
    }
  };

  for (const section of sections) {
    sectionIds.push(section.id);
    walk(section.nodes);
  }

  return { sectionIds, nodeIds };
};

const LargeTreeStory = () => {
  const sections = useMemo(
    () => buildLargeTreeSections(LARGE_TREE_GROUPS, LARGE_TREE_LEAVES_PER_BRANCH, LARGE_TREE_BRANCHES_PER_GROUP),
    [],
  );
  const { sectionIds: allSectionIds, nodeIds: allExpandableNodeIds } = useMemo(
    () => collectExpandableIds(sections),
    [sections],
  );
  const totalLeafCount = LARGE_TREE_GROUPS * LARGE_TREE_BRANCHES_PER_GROUP * LARGE_TREE_LEAVES_PER_BRANCH;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(allSectionIds);
  const [expandedNodes, setExpandedNodes] = useState<string[]>(["group-0/branch-0"]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const handleNavigate = (event: TreeListNavigateEvent) => {
    setActiveNodeId(event.nodeId);
  };

  const expandAll = () => {
    setExpandedSections(allSectionIds);
    setExpandedNodes(allExpandableNodeIds);
  };

  const collapseAll = () => {
    setExpandedSections([]);
    setExpandedNodes([]);
  };

  return (
    <Stack maxW="22rem" gap="sm">
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {LARGE_TREE_GROUPS} sections × {LARGE_TREE_BRANCHES_PER_GROUP} branches × {LARGE_TREE_LEAVES_PER_BRANCH} leaves
        ({totalLeafCount.toLocaleString()} leaves). Only the rows visible inside the scroll viewport are rendered to
        the DOM.
      </Text>
      <HStack gap="xs">
        <Button size="xs" variant="outline" onClick={expandAll}>
          Expand all
        </Button>
        <Button size="xs" variant="outline" onClick={collapseAll}>
          Collapse all
        </Button>
      </HStack>
      <Box
        ref={scrollRef}
        borderWidth="1px"
        h="32rem"
        overflowY="auto"
        overflowX="hidden"
        data-testid="large-tree-scroll-viewport"
      >
        <TreeList
          sections={sections}
          expandedSectionIds={expandedSections}
          expandedNodeIds={expandedNodes}
          activeNodeId={activeNodeId}
          rowVariant="compact"
          onNavigate={handleNavigate}
          onToggleSection={(id) => setExpandedSections((current) => toggleId(current, id))}
          onToggleNode={(id) => setExpandedNodes((current) => toggleId(current, id))}
          virtualize
          scrollRef={scrollRef}
        />
      </Box>
    </Stack>
  );
};

export const SectionedNavigation: Story = {
  render: () => <SectionedNavigationStory />,
};

export const FileTree: Story = {
  render: () => <FileTreeStory />,
};

export const LargeTree: Story = {
  name: "Large Tree (virtualized)",
  render: () => <LargeTreeStory />,
};

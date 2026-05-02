import { Box, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { EllipsisVertical, FileText, Folder, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { TreeList } from "./tree-list";
import type { TreeListNavigateEvent, TreeListSection } from "./tree-list.types";

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
        icon: <Folder size={14} />,
        isContainer: true,
        children: [
          {
            id: "src/components",
            label: "components",
            icon: <Folder size={14} />,
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

export const SectionedNavigation: Story = {
  render: () => <SectionedNavigationStory />,
};

export const FileTree: Story = {
  render: () => <FileTreeStory />,
};

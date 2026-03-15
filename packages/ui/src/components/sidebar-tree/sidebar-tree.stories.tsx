import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Copy, EllipsisVertical, FileText, Folder, Home, Link, Plus, Settings, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { SidebarTree } from "./sidebar-tree";
import type { SidebarSection } from "./sidebar-tree.types";

const treeSections: SidebarSection[] = [
  {
    id: "top-level",
    nodes: [
      { id: "home", label: "Home", icon: <Home size={14} />, isNavigable: true },
      { id: "settings", label: "Settings", icon: <Settings size={14} />, isNavigable: true },
    ],
  },
  {
    id: "getting-started",
    label: "Getting Started",
    actions: [{ id: "new-doc", label: "Add doc", icon: <Plus size={14} /> }],
    nodes: [
      {
        id: "overview",
        label: "Overview",
        icon: <FileText size={14} />,
        isNavigable: true,
        navigationIntent: { id: "doc/overview", payload: { slug: "overview" } },
        actions: [
          {
            id: "more",
            label: "More actions",
            icon: <EllipsisVertical size={14} />,
            menuItems: [
              { id: "copy-link", label: "Copy link", icon: <Link size={14} /> },
              { id: "duplicate", label: "Duplicate", icon: <Copy size={14} /> },
              { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
            ],
          },
        ],
      },
      {
        id: "quickstart",
        label: "Quickstart",
        icon: <FileText size={14} />,
        isNavigable: true,
        actions: [
          {
            id: "more",
            label: "More actions",
            icon: <EllipsisVertical size={14} />,
            menuItems: [
              { id: "copy-link", label: "Copy link", icon: <Link size={14} /> },
              { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "guides",
    label: "Guides",
    nodes: [
      {
        id: "projects",
        label: "Projects",
        icon: <Folder size={14} />,
        actions: [
          { id: "add", label: "Add project", icon: <Plus size={14} /> },
          {
            id: "more",
            label: "More actions",
            icon: <EllipsisVertical size={14} />,
            menuItems: [
              { id: "copy-link", label: "Copy link", icon: <Link size={14} /> },
              { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
            ],
          },
        ],
        children: [
          {
            id: "create-project",
            label: "Create a project",
            icon: <FileText size={14} />,
            isNavigable: true,
          },
          {
            id: "hybrid-node",
            label: "Project settings",
            icon: <Star size={14} />,
            isNavigable: true,
            children: [
              {
                id: "project-settings-advanced",
                label: "Advanced",
                isNavigable: true,
              },
            ],
          },
        ],
      },
      {
        id: "pipelines",
        label: "Pipelines",
        icon: <Folder size={14} />,
        children: [
          {
            id: "author-pipeline",
            label: "Author pipeline",
            isNavigable: true,
          },
          {
            id: "run-pipeline",
            label: "Run pipeline",
            isNavigable: true,
            disabled: true,
            description: "Coming soon",
          },
        ],
      },
    ],
  },
];

const InteractiveTree = (props: { sections?: SidebarSection[] }) => {
  const { sections = treeSections } = props;
  const [expandedSections, setExpandedSections] = useState<string[]>(["getting-started", "guides"]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>(["projects", "pipelines"]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>("overview");
  const [lastIntent, setLastIntent] = useState("none");

  return (
    <HStack align="stretch" gap="4" h="100%">
      <Box w="320px" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
        <SidebarTree
          sections={sections}
          expandedSections={expandedSections}
          expandedNodes={expandedNodes}
          activeNodeId={activeNodeId}
          onToggleSection={(sectionId) =>
            setExpandedSections((current) =>
              current.includes(sectionId) ? current.filter((entry) => entry !== sectionId) : [...current, sectionId],
            )
          }
          onToggleNode={(nodeId) =>
            setExpandedNodes((current) =>
              current.includes(nodeId) ? current.filter((entry) => entry !== nodeId) : [...current, nodeId],
            )
          }
          onNavigate={(event) => {
            setActiveNodeId(event.nodeId);
            setLastIntent(event.intent?.id ?? "none");
          }}
        />
      </Box>

      <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" p="3" minW="220px">
        <Text textStyle="paragraph/S/medium">Event Output</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Active Node: {activeNodeId ?? "none"}
        </Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Intent: {lastIntent}
        </Text>
      </Box>
    </HStack>
  );
};

const meta: Meta<typeof SidebarTree> = {
  title: "Sidebar/SidebarTree",
  component: SidebarTree,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof SidebarTree>;

export const DefaultDocsTree: Story = {
  render: () => <InteractiveTree />,
};

export const NodeBehavior: Story = {
  render: () => <InteractiveTree />,
  parameters: {
    docs: {
      description: {
        story: "Clicking a parent node toggles expand/collapse. Leaf nodes navigate on click.",
      },
    },
  },
};

export const DisabledRows: Story = {
  render: () => <InteractiveTree />,
  parameters: {
    docs: {
      description: {
        story: "Disabled rows remain visible but are non-interactive.",
      },
    },
  },
};

export const RowActionsWithMenu: Story = {
  render: () => {
    const sections: SidebarSection[] = [
      {
        id: "team",
        label: "Wooosh",
        actions: [
          {
            id: "more",
            label: "Team actions",
            icon: <EllipsisVertical size={14} />,
            menuItems: [
              { id: "settings", label: "Team settings", icon: <Settings size={14} /> },
              { id: "copy-link", label: "Copy link", icon: <Link size={14} /> },
            ],
          },
        ],
        nodes: [
          {
            id: "issues",
            label: "Issues",
            icon: <FileText size={14} />,
            isNavigable: true,
            actions: [
              { id: "add", label: "Add issue", icon: <Plus size={14} /> },
              {
                id: "more",
                label: "More actions",
                icon: <EllipsisVertical size={14} />,
                menuItems: [
                  { id: "copy-link", label: "Copy link", icon: <Link size={14} /> },
                  { id: "duplicate", label: "Duplicate", icon: <Copy size={14} /> },
                  { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
                ],
              },
            ],
          },
          {
            id: "projects",
            label: "Projects",
            icon: <Folder size={14} />,
            isNavigable: true,
            actions: [
              {
                id: "more",
                label: "More actions",
                icon: <EllipsisVertical size={14} />,
                menuItems: [
                  { id: "copy-link", label: "Copy link", icon: <Link size={14} /> },
                  { id: "delete", label: "Delete", icon: <Trash2 size={14} /> },
                ],
              },
            ],
          },
          {
            id: "views",
            label: "Views",
            icon: <Star size={14} />,
            isNavigable: true,
          },
        ],
      },
    ];

    const [expandedSections, setExpandedSections] = useState<string[]>(["team"]);
    const [activeNodeId, setActiveNodeId] = useState<string | null>("issues");

    return (
      <Box w="280px" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
        <SidebarTree
          sections={sections}
          expandedSections={expandedSections}
          expandedNodes={[]}
          activeNodeId={activeNodeId}
          onToggleSection={(sectionId) =>
            setExpandedSections((current) =>
              current.includes(sectionId) ? current.filter((entry) => entry !== sectionId) : [...current, sectionId],
            )
          }
          onToggleNode={() => {}}
          onNavigate={(event) => setActiveNodeId(event.nodeId)}
        />
      </Box>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Hover over a row to reveal action buttons. The ··· button opens a dropdown menu.",
      },
    },
  },
};

export const DeepNesting: Story = {
  render: () => {
    const deepSections: SidebarSection[] = [
      {
        id: "nested",
        label: "Nested",
        nodes: [
          {
            id: "level-1",
            label: "Level 1",
            children: [
              {
                id: "level-2",
                label: "Level 2",
                children: [
                  {
                    id: "level-3",
                    label: "Level 3",
                    children: [
                      {
                        id: "level-4",
                        label: "Level 4 leaf",
                        isNavigable: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const [expandedSections, setExpandedSections] = useState<string[]>(["nested"]);
    const [expandedNodes, setExpandedNodes] = useState<string[]>(["level-1", "level-2", "level-3"]);

    return (
      <Box w="320px" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
        <SidebarTree
          sections={deepSections}
          expandedSections={expandedSections}
          expandedNodes={expandedNodes}
          onToggleSection={(sectionId) =>
            setExpandedSections((current) =>
              current.includes(sectionId) ? current.filter((entry) => entry !== sectionId) : [...current, sectionId],
            )
          }
          onToggleNode={(nodeId) =>
            setExpandedNodes((current) =>
              current.includes(nodeId) ? current.filter((entry) => entry !== nodeId) : [...current, nodeId],
            )
          }
        />
      </Box>
    );
  },
};

export const LongItemNames: Story = {
  render: () => {
    const sections: SidebarSection[] = [
      {
        id: "long-names",
        label: "A very long section label that should truncate nicely",
        actions: [{ id: "add", label: "Add", icon: <Plus size={14} /> }],
        nodes: [
          {
            id: "long-leaf",
            label: "This is an extremely long document title that should be truncated with an ellipsis",
            icon: <FileText size={14} />,
            isNavigable: true,
            actions: [
              {
                id: "more",
                label: "More actions",
                icon: <EllipsisVertical size={14} />,
                menuItems: [{ id: "delete", label: "Delete", icon: <Trash2 size={14} /> }],
              },
            ],
          },
          {
            id: "long-parent",
            label: "A parent node with a really long name that overflows the sidebar width",
            icon: <Folder size={14} />,
            children: [
              {
                id: "long-child",
                label: "Deeply nested child with another very long name to test truncation at multiple levels",
                icon: <FileText size={14} />,
                isNavigable: true,
              },
            ],
          },
          {
            id: "short",
            label: "Short",
            icon: <Star size={14} />,
            isNavigable: true,
          },
        ],
      },
    ];

    const [expandedSections, setExpandedSections] = useState<string[]>(["long-names"]);
    const [expandedNodes, setExpandedNodes] = useState<string[]>(["long-parent"]);

    return (
      <Box w="260px" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
        <SidebarTree
          sections={sections}
          expandedSections={expandedSections}
          expandedNodes={expandedNodes}
          onToggleSection={(sectionId) =>
            setExpandedSections((current) =>
              current.includes(sectionId) ? current.filter((entry) => entry !== sectionId) : [...current, sectionId],
            )
          }
          onToggleNode={(nodeId) =>
            setExpandedNodes((current) =>
              current.includes(nodeId) ? current.filter((entry) => entry !== nodeId) : [...current, nodeId],
            )
          }
        />
      </Box>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Long labels truncate with an ellipsis instead of wrapping to a second line.",
      },
    },
  },
};

export const EmptySection: Story = {
  render: () => {
    const sections: SidebarSection[] = [
      {
        id: "docs",
        label: "Documentation",
        actions: [{ id: "add", label: "Add document", icon: <Plus size={14} /> }],
        emptyState: (
          <Stack align="center" gap="2" py="4" px="3">
            <Text textStyle="paragraph/S/regular" color="fg.muted" textAlign="center">
              No documents yet
            </Text>
            <Button size="xs" variant="outline">
              <Plus size={14} />
              Add document
            </Button>
          </Stack>
        ),
        nodes: [],
      },
      {
        id: "guides",
        label: "Guides",
        nodes: [{ id: "quickstart", label: "Quickstart", icon: <FileText size={14} />, isNavigable: true }],
      },
    ];

    const [expandedSections, setExpandedSections] = useState<string[]>(["docs", "guides"]);

    return (
      <Box w="280px" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
        <SidebarTree
          sections={sections}
          expandedSections={expandedSections}
          expandedNodes={[]}
          onToggleSection={(sectionId) =>
            setExpandedSections((current) =>
              current.includes(sectionId) ? current.filter((entry) => entry !== sectionId) : [...current, sectionId],
            )
          }
          onToggleNode={() => {}}
        />
      </Box>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "An expanded section with no nodes renders an empty state with a call to action.",
      },
    },
  },
};

export const ContainerLabelTogglesExpansion: Story = {
  render: () => {
    const [expandedSections, setExpandedSections] = useState<string[]>(["guides"]);
    const [expandedNodes, setExpandedNodes] = useState<string[]>([]);

    return (
      <Box>
        <Button size="sm" mb="3" onClick={() => setExpandedNodes([])}>
          Reset expanded nodes
        </Button>
        <Box w="320px" borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
          <SidebarTree
            sections={treeSections.filter((section) => section.id === "guides")}
            expandedSections={expandedSections}
            expandedNodes={expandedNodes}
            onToggleSection={(sectionId) =>
              setExpandedSections((current) =>
                current.includes(sectionId) ? current.filter((entry) => entry !== sectionId) : [...current, sectionId],
              )
            }
            onToggleNode={(nodeId) =>
              setExpandedNodes((current) =>
                current.includes(nodeId) ? current.filter((entry) => entry !== nodeId) : [...current, nodeId],
              )
            }
          />
        </Box>
      </Box>
    );
  },
};

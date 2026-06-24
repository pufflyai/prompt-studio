import { Box, Button, Flex, HStack, Kbd, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Check, Copy, EllipsisVertical, FileText, Folder, Plus, Search, Settings, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { ScrollArea } from "../scroll-area";
import { TreeList } from "./tree-list";
import type { TreeListNavigateEvent, TreeListNode, TreeListSection } from "./tree-list.types";
import { applyTreeListOrder } from "./tree-list-order-filter";
import { useTreeListVisibilityStore, type VisibilityOverride } from "./tree-list-visibility.store";
import { buildTreeVisibilityMenuActions, filterVisibleSections } from "./tree-list-visibility-filter";

const meta: Meta<typeof TreeList> = {
  title: "Components/Data Display/Tree List",
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

const shortcutSections: TreeListSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    nodes: [
      {
        id: "overview",
        label: "Overview",
        icon: <FileText size={14} />,
        actions: [
          {
            id: "add",
            label: "Add",
            icon: <Plus size={14} />,
            tooltip: (
              <HStack gap="2">
                <Text>Add</Text>
                <Kbd>⌘N</Kbd>
              </HStack>
            ),
          },
          { id: "copy", label: "Copy", icon: <Copy size={14} /> },
        ],
        menuItems: [
          { id: "rename", label: "Rename", endContent: <Kbd>F2</Kbd> },
          { id: "delete", label: "Delete", icon: <Trash2 size={14} />, endContent: <Kbd>⌫</Kbd> },
        ],
        contextMenuItems: [
          { id: "rename-ctx", label: "Rename", endContent: <Kbd>F2</Kbd> },
          { id: "delete-ctx", label: "Delete", icon: <Trash2 size={14} />, endContent: <Kbd>⌫</Kbd> },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        icon: <Settings size={14} />,
      },
    ],
  },
];

const ShortcutTreeStory = () => (
  <Stack maxW="20rem" borderWidth="1px" p="xs">
    <TreeList sections={shortcutSections} expandedSectionIds={["workspace"]} rowVariant="compact" sectionGap="md" />
    <Text textStyle="label/XS" color="fg.muted">
      Hover the Add icon for a tooltip with a Kbd hint. Click the row chevron / right-click for menus with trailing Kbd.
    </Text>
  </Stack>
);

const reorderSections: TreeListSection[] = [
  {
    id: "favorites",
    label: "Favorites",
    nodes: [
      { id: "inbox", label: "Inbox", icon: <FileText size={14} /> },
      { id: "drafts", label: "Drafts", icon: <FileText size={14} /> },
      { id: "archive", label: "Archive", icon: <FileText size={14} /> },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    nodes: [
      { id: "alpha", label: "Alpha", icon: <Folder size={14} /> },
      { id: "beta", label: "Beta", icon: <Folder size={14} /> },
    ],
  },
];

const ReorderableStory = () => {
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [nodeOrderBySection, setNodeOrderBySection] = useState<Record<string, string[]>>({});

  const sections = applyTreeListOrder(reorderSections, sectionOrder, nodeOrderBySection);

  return (
    <Stack maxW="20rem" gap="md">
      <Stack borderWidth="1px" p="xs">
        <TreeList
          sections={sections}
          expandedSectionIds={["favorites", "projects"]}
          rowVariant="compact"
          sectionGap="md"
          draggable
          onReorderSections={setSectionOrder}
          onReorderNodes={(sectionId, nextNodeIds) =>
            setNodeOrderBySection((current) => ({ ...current, [sectionId]: nextNodeIds }))
          }
        />
      </Stack>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setSectionOrder([]);
          setNodeOrderBySection({});
        }}
      >
        Reset order
      </Button>
      <Text textStyle="label/XS" color="fg.muted">
        Drag a section header or a row (move 4px to start). Nested rows stay anchored to their parent.
      </Text>
    </Stack>
  );
};

const visibilitySections: TreeListSection[] = [
  {
    id: "primary",
    label: "Primary",
    nodes: [
      { id: "overview", label: "Overview", icon: <FileText size={14} /> },
      { id: "activity", label: "Activity", icon: <FileText size={14} /> },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    hiddenByDefault: true,
    nodes: [{ id: "debug", label: "Debug", icon: <Settings size={14} /> }],
  },
];

const VisibilityStory = () => {
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, VisibilityOverride>>({});
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, VisibilityOverride>>({});

  const sections = filterVisibleSections(visibilitySections, sectionOverrides, nodeOverrides);

  return (
    <Stack maxW="20rem" gap="md">
      <Stack borderWidth="1px" p="xs">
        <TreeList
          sections={sections}
          expandedSectionIds={["primary", "advanced"]}
          rowVariant="compact"
          sectionGap="md"
        />
      </Stack>
      <HStack gap="xs">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSectionOverrides((current) => ({ ...current, advanced: "shown" }))}
        >
          Show Advanced
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setNodeOverrides((current) => ({ ...current, activity: "hidden" }))}
        >
          Hide Activity
        </Button>
      </HStack>
      <Text textStyle="label/XS" color="fg.muted">
        The Advanced section is hiddenByDefault. Overrides toggle visibility without mutating the source tree.
      </Text>
    </Stack>
  );
};

export const SectionedNavigation: Story = {
  render: () => <SectionedNavigationStory />,
};

export const FileTree: Story = {
  render: () => <FileTreeStory />,
};

export const ActionShortcuts: Story = {
  render: () => <ShortcutTreeStory />,
};

export const Reorderable: Story = {
  render: () => <ReorderableStory />,
};

export const Visibility: Story = {
  render: () => <VisibilityStory />,
};

const customizationHeaderNodes: TreeListNode[] = [
  { id: "search", label: "Search", icon: <Search size={14} />, canHide: true },
];
const customizationFooterNodes: TreeListNode[] = [
  { id: "help", label: "Help", icon: <Settings size={14} />, canHide: true },
];
const customizationSections: TreeListSection[] = [
  {
    id: "navigation",
    label: "Navigation",
    canHide: true,
    nodes: [
      // Leaf rows never opt in, so they stay out of the customize menu — you hide the category, not a row.
      { id: "tickets", label: "Tickets", icon: <FileText size={14} /> },
      { id: "planner", label: "Planner", icon: <Settings size={14} /> },
    ],
  },
  {
    id: "files",
    label: "Files",
    canHide: true,
    hiddenByDefault: true,
    nodes: [{ id: "readme", label: "README.md", icon: <Folder size={14} /> }],
  },
];

const customizationMenuItems = {
  headerNodes: customizationHeaderNodes,
  sections: customizationSections,
  footerNodes: customizationFooterNodes,
};
const customizationMenuIcons = { visibleIcon: <Check size={14} />, hiddenIcon: <Check size={14} /> };

const CUSTOMIZATION_KEY = "storybook/tree-customization";

const BackgroundContextMenuStory = () => {
  const sectionOverrides = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.sectionOverrides);
  const nodeOverrides = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.nodeOverrides);
  const toggleSection = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.toggleSection);
  const toggleNode = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.toggleNode);
  const reset = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.reset);

  const sections = filterVisibleSections(customizationSections, sectionOverrides, nodeOverrides);
  const backgroundContextActions = buildTreeVisibilityMenuActions(
    customizationMenuItems,
    sectionOverrides,
    nodeOverrides,
    { onToggleSection: toggleSection, onToggleNode: toggleNode, onResetAll: reset },
    customizationMenuIcons,
  );

  return (
    <Stack maxW="20rem" gap="md">
      <Box borderWidth="1px" h="16rem" overflow="hidden">
        <TreeList
          sections={sections}
          expandedSectionIds={["workspace-actions", "navigation"]}
          rowVariant="compact"
          sectionGap="md"
          backgroundContextActions={backgroundContextActions}
        />
      </Box>
      <Text textStyle="label/XS" color="fg.muted">
        Right-click the empty area below the items to open the customize menu. Toggle entries (they disappear /
        reappear), or Reset to default — the menu stays open across toggles. Only opted-in categories and header/footer
        rows are listed (e.g. "Navigation", "Search", "Help"); leaf rows are never hideable. "Files" is hiddenByDefault.
      </Text>
    </Stack>
  );
};

export const BackgroundContextMenu: Story = {
  render: () => <BackgroundContextMenuStory />,
};

// Mirrors the dashboard host (WorkbenchTreeView): TreeList inside a flex-column
// ScrollArea. Verifies the back-of-tree menu is reachable across the whole
// scroll area, not just the rows.
const BackgroundContextMenuInScrollAreaStory = () => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionOverrides = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.sectionOverrides);
  const nodeOverrides = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.nodeOverrides);
  const toggleSection = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.toggleSection);
  const toggleNode = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.toggleNode);
  const reset = useTreeListVisibilityStore(CUSTOMIZATION_KEY, (state) => state.reset);

  const sections = filterVisibleSections(customizationSections, sectionOverrides, nodeOverrides);
  const backgroundContextActions = buildTreeVisibilityMenuActions(
    customizationMenuItems,
    sectionOverrides,
    nodeOverrides,
    { onToggleSection: toggleSection, onToggleNode: toggleNode, onResetAll: reset },
    customizationMenuIcons,
  );

  return (
    <Flex direction="column" h="20rem" maxW="20rem" borderWidth="1px">
      <ScrollArea
        flex="1"
        minH="0"
        w="full"
        viewportRef={scrollRef}
        viewportProps={{ display: "block", style: { overflowX: "hidden" } }}
        contentProps={{
          style: { minWidth: "100%", width: "100%", minHeight: "100%", display: "flex", flexDirection: "column" },
        }}
      >
        <Box w="full" minW="0" flex="1 0 auto" display="flex" flexDirection="column">
          <TreeList
            sections={sections}
            expandedSectionIds={["workspace-actions", "navigation"]}
            rowVariant="compact"
            sectionGap="md"
            backgroundContextActions={backgroundContextActions}
            scrollRef={scrollRef}
          />
        </Box>
      </ScrollArea>
    </Flex>
  );
};

export const BackgroundContextMenuInScrollArea: Story = {
  render: () => <BackgroundContextMenuInScrollAreaStory />,
};

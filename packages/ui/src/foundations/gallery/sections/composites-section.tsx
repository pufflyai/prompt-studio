import { Badge, Box, Button, Icon as ChakraIcon, Text } from "@chakra-ui/react";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleDot,
  FileText,
  Folder,
  GitBranch,
  MessageSquare,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import { Activity, type ActivityActor } from "@/components/activity";
import type { AttributeDescriptor, DataRendererRow } from "@/components/data-renderer";
import { DataRenderer, MANUAL_ORDERING, NO_GROUPING } from "@/components/data-renderer";
import { DataTable, type RowData } from "@/components/data-table";
import { MermaidRenderer } from "@/components/mermaid-renderer/mermaid-renderer";
import { TreeList } from "@/components/tree-list/tree-list";
import type { TreeListSection } from "@/components/tree-list/tree-list.types";
import { GalleryCard, GallerySection } from "../gallery-frame";
import { CompositeChatSection } from "./composite-chat-section";
import { InputAuthoringCard } from "./input-authoring-card";
import { ParamEditorCompositeCard } from "./param-editor-composite-card";
import { SettingsCompositeCards } from "./settings-composite-cards";

const reviewer: ActivityActor = { name: "Jordan Lee" };
const agent: ActivityActor = { name: "System Agent" };

const workflowAttributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "queued", label: "Queued", color: "gray" },
        { value: "running", label: "Running", color: "blue" },
        { value: "review", label: "Review", color: "purple" },
      ],
    },
    filterable: true,
    groupable: true,
    displayable: true,
    editable: true,
  },
  {
    id: "priority",
    label: "Priority",
    type: {
      kind: "enum",
      options: [
        { value: "normal", label: "Normal", color: "gray" },
        { value: "high", label: "High", color: "red" },
      ],
    },
    filterable: true,
    groupable: true,
    displayable: true,
    editable: true,
  },
  {
    id: "owner",
    label: "Owner",
    type: { kind: "user" },
    filterable: true,
    displayable: true,
  },
];

const workflowRows: DataRendererRow[] = [
  {
    id: "draft-system-prompt",
    title: "Draft system prompt",
    attributes: { status: "queued", priority: "normal", owner: "Ari" },
  },
  {
    id: "run-eval",
    title: "Run evaluation suite",
    attributes: { status: "running", priority: "high", owner: "Jordan" },
  },
  {
    id: "review-copy",
    title: "Review generated copy",
    attributes: { status: "review", priority: "normal", owner: "Mira" },
  },
  {
    id: "merge-notes",
    title: "Merge handoff notes",
    attributes: { status: "review", priority: "high", owner: "Ari" },
  },
];

const tableRows: RowData[] = [
  {
    id: "release-1",
    Change: "Refresh foundations gallery",
    Owner: "Design systems",
    Status: { display: <Badge colorPalette="green">Ready</Badge>, sortValue: "Ready" },
    Due: "Today",
  },
  {
    id: "release-2",
    Change: "Review dense tab states",
    Owner: "Workbench",
    Status: { display: <Badge colorPalette="purple">Review</Badge>, sortValue: "Review" },
    Due: "Tomorrow",
  },
  {
    id: "release-3",
    Change: "Patch input hover border",
    Owner: "UI package",
    Status: { display: <Badge colorPalette="blue">Running</Badge>, sortValue: "Running" },
    Due: "Friday",
  },
];

const tableColumnIcons = {
  Change: <ChakraIcon as={FileText} boxSize="14px" />,
  Owner: <ChakraIcon as={CheckCircle2} boxSize="14px" />,
  Status: <ChakraIcon as={CircleDot} boxSize="14px" />,
  Due: <ChakraIcon as={CalendarClock} boxSize="14px" />,
};

const treeSections: TreeListSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    nodes: [
      {
        id: "src",
        label: "src",
        icon: <Folder size={14} />,
        isContainer: true,
        children: [
          {
            id: "src-components",
            label: "components",
            icon: <Folder size={14} />,
            isContainer: true,
            children: [
              { id: "sidebar", label: "sidebar.tsx", icon: <FileText size={14} />, endContent: <Badge>tsx</Badge> },
              {
                id: "tree-list",
                label: "tree-list.tsx",
                icon: <FileText size={14} />,
                endContent: <Badge>tsx</Badge>,
              },
            ],
          },
          { id: "theme", label: "theme.ts", icon: <Settings size={14} />, endContent: <Badge>ts</Badge> },
        ],
      },
      { id: "package", label: "package.json", icon: <FileText size={14} />, endContent: <Badge>json</Badge> },
    ],
  },
];

const diagramCode = `flowchart LR
  Input[Input]
  Theme[Theme recipe]
  Gallery[Gallery story]
  Validate[Validate]
  Input --> Theme --> Gallery --> Validate`;

const dataRendererColumnColor = (groupKey: string) => {
  if (groupKey === "running") return { color: "blue" };
  if (groupKey === "review") return { color: "purple" };
  return { color: "gray" };
};

export const CompositesSection = () => {
  return (
    <GallerySection
      title="Advanced components"
      description="Composed UI surfaces that own richer state, density, or workflow structure."
    >
      <GalleryCard title="Workflow renderer" names={["DataRenderer"]} gridColumn={{ base: "auto", xl: "span 2" }}>
        <Box height="28rem" minW="0" overflow="hidden">
          <DataRenderer
            storageKey="component-gallery-composites-workflow"
            rows={workflowRows}
            attributes={workflowAttributes}
            selectedRowId="run-eval"
            defaultSettings={{
              viewMode: "list",
              columnGrouping: "status",
              rowGrouping: NO_GROUPING,
              ordering: { attributeId: MANUAL_ORDERING, direction: "asc" },
              displayProperties: ["priority", "owner"],
            }}
            getBoardColumnConfig={dataRendererColumnColor}
          />
        </Box>
      </GalleryCard>

      <GalleryCard title="Data table" names={["DataTable"]} gridColumn={{ base: "auto", xl: "span 2" }}>
        <Box height="18rem" minW="0" overflow="hidden">
          <DataTable data={tableRows} hiddenColumns={["id"]} columnIcons={tableColumnIcons} />
        </Box>
      </GalleryCard>

      <GalleryCard title="Tree navigation" names={["TreeList"]}>
        <Box width="100%" borderWidth="1px" borderColor="border.subtle" borderRadius="xs" overflow="hidden" py="xs">
          <TreeList
            sections={treeSections}
            expandedSectionIds={["workspace"]}
            expandedNodeIds={["src", "src-components"]}
            activeNodeId="tree-list"
            rowVariant="tree"
            nodeGap="1px"
          />
        </Box>
      </GalleryCard>

      <ParamEditorCompositeCard />

      <InputAuthoringCard />

      <SettingsCompositeCards />

      <GalleryCard title="Activity feed" names={["Activity"]}>
        <Activity.Root>
          <Activity.Header
            title="Review activity"
            actions={
              <Button size="xs" variant="outline">
                Resolve
              </Button>
            }
          />
          <Activity.Feed>
            <Activity.Timeline>
              <Activity.Event actor={agent} icon={<Circle size={8} fill="currentColor" />} timestamp="09:12">
                opened a review run
              </Activity.Event>
              <Activity.Event actor={reviewer} icon={<GitBranch size={12} />} timestamp="09:16">
                moved run to <Badge colorPalette="purple">Review</Badge>
              </Activity.Event>
            </Activity.Timeline>
            <Activity.Comment
              actor={reviewer}
              timestamp="09:20"
              actions={
                <Button size="xs" variant="ghost">
                  Reply
                </Button>
              }
            >
              The summary is ready. Keep the risk note attached to the release checklist.
            </Activity.Comment>
            <Activity.Timeline>
              <Activity.Event actor={agent} icon={<CircleDot size={12} />} timestamp="09:24">
                attached <Text as="span">validation results</Text>
              </Activity.Event>
              <Activity.Event actor={reviewer} icon={<MessageSquare size={12} />} timestamp="09:26">
                left a final comment
              </Activity.Event>
              <Activity.Event actor={reviewer} icon={<MoreHorizontal size={12} />} timestamp="09:27">
                updated labels
              </Activity.Event>
            </Activity.Timeline>
          </Activity.Feed>
        </Activity.Root>
      </GalleryCard>

      <GalleryCard title="Diagram renderer" names={["MermaidRenderer"]} gridColumn={{ base: "auto", xl: "span 2" }}>
        <Box minW="0" overflow="hidden">
          <MermaidRenderer code={diagramCode} />
        </Box>
      </GalleryCard>

      <CompositeChatSection />
    </GallerySection>
  );
};

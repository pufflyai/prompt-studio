import { Badge, Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import {
  type AttributeDescriptor,
  type KanbanRendererRow,
  type KanbanRendererSettings,
  MANUAL_ORDERING,
  NO_GROUPING,
} from "@pstdio/ui/kanban-renderer";
import { createWorkbench, type WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { createShowcaseStore, initials, useShowcaseStore } from "./showcase-store";
import { ziplineTheme } from "./themes";
import { type IssueStatus, type ZiplineIssue, ziplineIssues } from "./zipline-data";
import { WorkspaceNav, ZiplineRail } from "./zipline-navigation";

const page: PageRef = { extensionId: "storybook.showcases", kind: "page", id: "zipline" };
const resource = (issue: ZiplineIssue): ResourceRef => ({ type: "zipline.issue", id: issue.id, label: issue.title });
const store = createShowcaseStore({
  statuses: Object.fromEntries(ziplineIssues.map((issue) => [issue.id, issue.status])) as Record<string, IssueStatus>,
});
const statusIcons: Record<IssueStatus, string> = {
  Backlog: "Circle",
  "In progress": "CircleDotDashed",
  Done: "CircleCheckBig",
};
const statusColors: Record<IssueStatus, string> = { Backlog: "gray", "In progress": "purple", Done: "green" };
const nextStatuses: Record<IssueStatus, IssueStatus> = {
  Backlog: "In progress",
  "In progress": "Done",
  Done: "Backlog",
};

interface ZiplineBoardRow extends KanbanRendererRow {
  attributes: {
    id: string;
    status: IssueStatus;
    priority: ZiplineIssue["priority"];
    team: string;
    assignee: string;
  };
}

const boardAttributes: AttributeDescriptor[] = [
  { id: "id", label: "ID", type: { kind: "string" }, displayable: true },
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "Backlog", label: "Backlog", color: "gray", icon: "circle" },
        { value: "In progress", label: "In progress", color: "purple", icon: "circle-dot-dashed" },
        { value: "Done", label: "Done", color: "green", icon: "circle-check" },
      ],
    },
    filterable: true,
    groupable: true,
    sortable: true,
    editable: true,
  },
  {
    id: "priority",
    label: "Priority",
    type: {
      kind: "enum",
      options: [
        { value: "High", label: "High", color: "red" },
        { value: "Medium", label: "Medium", color: "yellow" },
        { value: "Low", label: "Low", color: "gray" },
      ],
    },
    filterable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "team",
    label: "Team",
    type: {
      kind: "enum",
      options: ["Product", "Platform", "Design", "Growth"].map((team) => ({ value: team, label: team })),
    },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: { kind: "user" },
    filterable: true,
    groupable: true,
    displayable: true,
  },
];

const boardSettings = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: NO_GROUPING,
  ordering: { attributeId: MANUAL_ORDERING, direction: "asc" },
  displayProperties: ["id", "priority", "team", "assignee"],
} satisfies Partial<KanbanRendererSettings>;

const getBoardRows = () => {
  const { statuses } = store.getState();
  return ziplineIssues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    attributes: {
      id: issue.id,
      status: statuses[issue.id],
      priority: issue.priority,
      team: issue.team,
      assignee: issue.assignee,
    },
  })) satisfies ZiplineBoardRow[];
};

const isIssueStatus = (value: unknown): value is IssueStatus =>
  value === "Backlog" || value === "In progress" || value === "Done";

const updateBoardAttribute = (rowId: string, attributeId: string, value: unknown) => {
  if (attributeId !== "status" || !isIssueStatus(value)) return;
  store.setState((state) => ({ ...state, statuses: { ...state.statuses, [rowId]: value } }));
};

const getBoardColumnConfig = (groupKey: string) => ({
  color: isIssueStatus(groupKey) ? statusColors[groupKey] : "gray",
  canDragIn: true,
  canDragOut: true,
});

const IssueInspector = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useShowcaseStore(store);
  const issue = ziplineIssues.find((item) => item.id === input.instance.resource?.id);
  if (!issue) return null;
  const status = state.statuses[issue.id];
  const nextStatus = nextStatuses[status];
  return (
    <Stack h="full" overflowY="auto" p="lg" gap="xl">
      <HStack justify="space-between">
        <HStack>
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            {issue.id}
          </Text>
          <Badge variant="outline">{issue.team}</Badge>
        </HStack>
        <IconButton
          aria-label="Close issue inspector"
          size="xs"
          variant="ghost"
          onClick={() => input.workbench.pageLocations.navigate({ kind: "page", page })}
        >
          <WorkbenchIcon name="X" />
        </IconButton>
      </HStack>
      <Stack gap="sm">
        <Text textStyle="heading/L/semibold">{issue.title}</Text>
        <Text color="fg.muted" textStyle="paragraph/M/regular">
          {issue.summary}
        </Text>
      </Stack>
      <Stack gap="sm">
        <Text textStyle="label/XS" color="fg.muted">
          STATUS
        </Text>
        <Button
          aria-label={`Change status from ${status} to ${nextStatus}`}
          variant="subtle"
          justifyContent="flex-start"
          onClick={() => store.setState({ statuses: { ...state.statuses, [issue.id]: nextStatus } })}
        >
          <WorkbenchIcon name={statusIcons[status]} />
          <Text flex="1" textAlign="left">
            {status}
          </Text>
          <WorkbenchIcon name="ChevronRight" color="fg.muted" />
        </Button>
      </Stack>
      <Stack gap="md">
        <Text textStyle="label/XS" color="fg.muted">
          DETAILS
        </Text>
        {[
          ["Priority", issue.priority],
          ["Assignee", issue.assignee],
          ["Team", issue.team],
        ].map(([label, value]) => (
          <HStack key={label} justify="space-between">
            <Text color="fg.muted" textStyle="paragraph/S/regular">
              {label}
            </Text>
            <Text textStyle="paragraph/S/semibold">{value}</Text>
          </HStack>
        ))}
      </Stack>
      <Stack gap="sm">
        <Text textStyle="label/XS" color="fg.muted">
          ACTIVITY
        </Text>
        <HStack align="start">
          <Box boxSize="7" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
            <Text textStyle="paragraph/XS/semibold">{initials(issue.assignee)}</Text>
          </Box>
          <Text textStyle="paragraph/S/regular">
            <Text as="span" fontWeight="semibold">
              {issue.assignee}
            </Text>{" "}
            moved this issue to {status}.
          </Text>
        </HStack>
      </Stack>
    </Stack>
  );
};

const IssueCount = () => {
  const state = useShowcaseStore(store);
  const open = Object.values(state.statuses).filter((status) => status !== "Done").length;
  return (
    <HStack h="full" px="sm">
      <WorkbenchIcon name="ListChecks" size={12} />
      <Text textStyle="paragraph/XS/regular">{open} open issues</Text>
    </HStack>
  );
};

export const createZiplineWorkbench = () => {
  const workbench = createWorkbench({ startPage: page, initialSidePanelMode: "floating" });
  workbench.themes.register([ziplineTheme]);
  workbench.modes.registerMode({
    id: "zipline",
    label: "Zipline",
    resourceKinds: ["zipline.issue"],
    regionSettings: {
      sidenav: { size: { defaultPx: 225, minPx: 200, maxPx: 300 }, collapsible: false },
      side: { size: { defaultPx: 360, minPx: 310, maxPx: 440 } },
    },
    activate: () => undefined,
  });
  workbench.views.registerView({
    id: "zipline.rail",
    title: "Zipline",
    body: { kind: "react", render: () => <ZiplineRail /> },
  });
  workbench.views.registerView({
    id: "zipline.workspace",
    title: "Workspace",
    body: { kind: "react", render: () => <WorkspaceNav /> },
  });
  workbench.views.registerView({
    id: "zipline.board",
    title: "My issues",
    body: {
      kind: "kanban",
      resourceKind: "zipline.issue",
      attributes: boardAttributes,
      defaultSettings: boardSettings,
      executeQuery: getBoardRows,
      subscribe: store.subscribe,
      onRowActivate: (row) => {
        const issue = ziplineIssues.find((item) => item.id === row.id);
        if (issue) workbench.pageLocations.navigate({ kind: "page", page, resource: resource(issue) });
      },
      onAttributeChange: updateBoardAttribute,
      getBoardColumnConfig,
      emptyTitle: "No issues",
      emptyDescription: "Change the board filters to see more work.",
    },
  });
  workbench.views.registerView({
    id: "zipline.inspector",
    title: "Issue",
    body: { kind: "react", render: (input) => <IssueInspector input={input} /> },
  });
  workbench.views.registerView({
    id: "zipline.count",
    title: "Issue count",
    body: { kind: "react", render: () => <IssueCount /> },
  });
  workbench.shellPlacements.registerPlacement({
    id: "zipline.rail",
    item: { kind: "view", viewId: "zipline.rail", presence: "fixed" },
    region: "activity",
  });
  workbench.statusBar.registerItem({ id: "zipline.count", viewId: "zipline.count", slot: "leading" });
  workbench.pages.registerPage({
    id: "zipline.issues",
    ref: page,
    title: "My issues",
    path: "zipline/issues",
    modeId: "zipline",
    slots: [
      { id: "workspace", role: "auxiliary", region: "sidenav", viewId: "zipline.workspace", presence: "fixed" },
      {
        id: "issues",
        role: "primary",
        region: "main",
        viewId: "zipline.board",
        binding: { resourceKinds: ["zipline.issue"], viewId: "zipline.board", cardinality: "one" },
      },
      {
        id: "inspector",
        role: "auxiliary",
        region: "side",
        binding: { resourceKinds: ["zipline.issue"], viewId: "zipline.inspector", cardinality: "one" },
        openOn: "page-resource",
        floatingPanels: "visible",
      },
    ],
  });
  workbench.pageLocations.switchProject("storybook-zipline");
  return workbench;
};

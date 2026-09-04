import { Badge, Box, Button, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { createShowcaseStore, initials, useShowcaseStore } from "./showcase-store";
import { ziplineTheme } from "./themes";
import { type IssueStatus, type ZiplineIssue, ziplineIssues } from "./zipline-data";
import { WorkspaceNav, ZiplineRail } from "./zipline-navigation";

type Filter = "All" | IssueStatus;
const page: PageRef = { extensionId: "storybook.showcases", kind: "page", id: "zipline" };
const resource = (issue: ZiplineIssue): ResourceRef => ({ type: "zipline.issue", id: issue.id, label: issue.title });
const store = createShowcaseStore({
  filter: "All" as Filter,
  query: "",
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

const StatusBadge = (props: { status: IssueStatus }) => (
  <Badge colorPalette={statusColors[props.status]}>
    <WorkbenchIcon name={statusIcons[props.status]} size={11} />
    {props.status}
  </Badge>
);

const IssueList = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useShowcaseStore(store);
  const issues = ziplineIssues.filter(
    (issue) =>
      (state.filter === "All" || state.statuses[issue.id] === state.filter) &&
      `${issue.id} ${issue.title}`.toLowerCase().includes(state.query.toLowerCase()),
  );
  return (
    <Stack h="full" bg="bg" overflow="hidden" gap="0">
      <HStack px="lg" py="md" borderBottomWidth="1px" borderColor="border.subtle" justify="space-between">
        <Stack gap="0">
          <Text textStyle="heading/M/semibold">My issues</Text>
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            Work assigned to you across Northstar
          </Text>
        </Stack>
        <Button size="sm">
          <WorkbenchIcon name="Plus" />
          New issue
        </Button>
      </HStack>
      <HStack p="md" borderBottomWidth="1px" borderColor="border.subtle" gap="sm" flexWrap="wrap">
        <Box position="relative" flex="1" minW="44">
          <Box position="absolute" insetStart="sm" top="50%" transform="translateY(-50%)">
            <WorkbenchIcon name="Search" color="fg.muted" />
          </Box>
          <Input
            aria-label="Search issues"
            value={state.query}
            onChange={(event) => store.setState({ query: event.target.value })}
            ps="xl"
            size="sm"
            placeholder="Search issues"
          />
        </Box>
        {(["All", "Backlog", "In progress", "Done"] as const).map((filter) => (
          <Button
            key={filter}
            aria-pressed={state.filter === filter}
            size="xs"
            variant={state.filter === filter ? "subtle" : "ghost"}
            onClick={() => store.setState({ filter })}
          >
            {filter}
          </Button>
        ))}
      </HStack>
      <Stack overflowY="auto" gap="0">
        {issues.map((issue) => {
          const status = state.statuses[issue.id];
          return (
            <HStack
              key={issue.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${issue.id}: ${issue.title}`}
              px="lg"
              py="md"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              cursor="pointer"
              _hover={{ bg: "bg.hover" }}
              onClick={() => input.workbench.pageLocations.navigate({ kind: "page", page, resource: resource(issue) })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  input.workbench.pageLocations.navigate({ kind: "page", page, resource: resource(issue) });
                }
              }}
            >
              <WorkbenchIcon name={statusIcons[status]} color={status === "Done" ? "fg.success" : "fg.muted"} />
              <Stack minW="0" flex="1" gap="xs">
                <HStack>
                  <Text color="fg.muted" textStyle="paragraph/XS/regular">
                    {issue.id}
                  </Text>
                  <Badge variant="outline">{issue.team}</Badge>
                </HStack>
                <Text truncate textStyle="paragraph/S/semibold">
                  {issue.title}
                </Text>
              </Stack>
              <StatusBadge status={status} />
              <Text display={{ base: "none", lg: "block" }} w="16" color="fg.muted" textStyle="paragraph/XS/regular">
                {issue.priority}
              </Text>
              <Box boxSize="7" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
                <Text textStyle="paragraph/XS/semibold">{initials(issue.assignee)}</Text>
              </Box>
            </HStack>
          );
        })}
        {issues.length === 0 ? (
          <Stack align="center" py="3xl">
            <WorkbenchIcon name="SearchX" size={28} color="fg.muted" />
            <Text color="fg.muted">No matching issues.</Text>
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
};

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
    id: "zipline.issues",
    title: "My issues",
    body: { kind: "react", render: (input) => <IssueList input={input} /> },
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
      { id: "issues", role: "primary", region: "main", viewId: "zipline.issues" },
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

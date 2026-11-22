import { Box, Stack, Text, Textarea } from "@chakra-ui/react";
import { Header, ScrollArea, TreeList } from "@pstdio/ui";
import { useLayoutEffect, useRef } from "react";
import { WorkbenchIcon } from "../../react/shared/icon";
import { type MenuState, menuLayout } from "./resource-menu-state";
import { filterResourceSections } from "./resource-search";

export const tickets = [
  { id: "DEMO-42", title: "Keep resource navigation with its view", file: "navigation-contract.md" },
  { id: "DEMO-43", title: "Review extension updates", file: "extension-review.md" },
] as const;

export interface ResourceState extends MenuState {
  selected: string;
  expanded: string[];
  scroll: number;
  draft: string;
  search: string;
  completed: boolean;
}

export const initialResourceState = (): ResourceState => ({
  selected: "overview",
  expanded: ["files", "related"],
  scroll: 0,
  ...menuLayout("right"),
  menuPolicy: "single",
  search: "",
  completed: false,
  draft: "Keep the ticket’s files and related resources available wherever its view is placed.",
});

interface ResourceNavigationTreeProps {
  ticket: (typeof tickets)[number];
  state: ResourceState;
  update: (change: Partial<ResourceState>) => void;
  onNavigate?: () => void;
}

export const ResourceNavigationTree = (props: ResourceNavigationTreeProps) => {
  const { ticket, state, update, onNavigate } = props;
  const scroll = useRef<HTMLDivElement>(null);
  // The prototype stores viewport state with the resource, including across a different host surface.
  // RB 4.A.5.6: moving a live view retains selection and edits. Local navigation is proposed here.
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = state.scroll;
  }, [state.scroll]);
  return (
    <Stack h="full" minH="0" gap="0" bg="bg" aria-label={`${ticket.id} Resources`}>
      <ScrollArea
        flex="1"
        minH="0"
        viewportRef={scroll}
        viewportProps={{ onScroll: (event) => update({ scroll: event.currentTarget.scrollTop }) }}
      >
        <TreeList
          rowVariant="compact"
          sections={filterResourceSections(
            [
              {
                id: "overview-section",
                nodes: [{ id: "overview", label: "Overview", icon: <WorkbenchIcon name="Ticket" /> }],
              },
              {
                id: "files",
                label: "Files",
                collapsible: true,
                nodes: [
                  { id: "spec", label: ticket.file, icon: <WorkbenchIcon name="FileText" /> },
                  { id: "notes", label: "review-notes.md", icon: <WorkbenchIcon name="FileText" /> },
                  {
                    id: "src",
                    label: "src",
                    icon: <WorkbenchIcon name="Folder" />,
                    children: [
                      { id: "view", label: "resource-view.tsx", icon: <WorkbenchIcon name="FileCode" /> },
                      { id: "tree", label: "navigation-tree.tsx", icon: <WorkbenchIcon name="FileCode" /> },
                    ],
                  },
                ],
              },
              {
                id: "related",
                label: "Related tickets",
                collapsible: true,
                nodes: [
                  { id: "dependency", label: "Define shared header controls", icon: <WorkbenchIcon name="Ticket" /> },
                  { id: "followup", label: "Verify keyboard navigation", icon: <WorkbenchIcon name="Ticket" /> },
                ],
              },
              {
                id: "workspaces",
                label: "Workspaces",
                collapsible: true,
                nodes: [{ id: "workspace", label: "Navigation prototype", icon: <WorkbenchIcon name="GitBranch" /> }],
              },
              {
                id: "sessions",
                label: "Sessions",
                collapsible: true,
                nodes: [
                  { id: "session", label: "Review resource navigation", icon: <WorkbenchIcon name="MessageSquare" /> },
                ],
              },
            ],
            state.search,
          )}
          expandedSectionIds={
            state.search ? ["overview-section", "files", "related", "workspaces", "sessions"] : state.expanded
          }
          expandedNodeIds={state.search ? ["src"] : state.expanded}
          activeNodeId={state.selected}
          onSelectionChange={(ids) => {
            const selected = ids.at(-1);
            if (selected) {
              update({ selected });
              onNavigate?.();
            }
          }}
          onToggleSection={(id) => update({ expanded: toggle(state.expanded, id) })}
          onToggleNode={(id) => update({ expanded: toggle(state.expanded, id) })}
          onNavigate={({ nodeId }) => {
            update({ selected: nodeId });
            onNavigate?.();
          }}
        />
      </ScrollArea>
    </Stack>
  );
};

const toggle = (values: string[], id: string) =>
  values.includes(id) ? values.filter((value) => value !== id) : [...values, id];

export const ProjectNavigation = () => (
  <Stack h="full" gap="0" bg="bg">
    <Header variant="narrow">
      <Text textStyle="label/S/medium">Project</Text>
    </Header>
    <TreeList
      rowVariant="compact"
      activeNodeId="planner"
      sections={[
        {
          id: "project",
          nodes: [
            { id: "home", label: "Home", icon: <WorkbenchIcon name="House" /> },
            { id: "planner", label: "Planner", icon: <WorkbenchIcon name="ListTodo" /> },
            { id: "files", label: "Files", icon: <WorkbenchIcon name="Folder" /> },
            { id: "extensions", label: "Extensions", icon: <WorkbenchIcon name="Puzzle" /> },
          ],
        },
      ]}
    />
  </Stack>
);

export const TicketContent = (props: ResourceNavigationTreeProps) => {
  const { ticket, state, update } = props;
  const isOverview = state.selected === "overview";
  const fileNames: Record<string, string> = {
    spec: ticket.file,
    notes: "review-notes.md",
    view: "resource-view.tsx",
    tree: "navigation-tree.tsx",
    dependency: "Define shared header controls",
    followup: "Verify keyboard navigation",
    workspace: "Navigation prototype",
    session: "Review resource navigation",
  };
  return (
    <ScrollArea flex="1" minW="0" minH="0" h="full">
      <Stack p="lg" gap="lg" maxW="3xl">
        <Stack gap="xs">
          <Text textStyle="label/S" color="fg.muted">
            {ticket.id} {isOverview ? `· ${state.completed ? "Done" : "In progress"}` : "· Resource preview"}
          </Text>
          <Text textStyle="heading/M">{isOverview ? ticket.title : (fileNames[state.selected] ?? state.selected)}</Text>
        </Stack>
        <Text color="fg.muted">
          {isOverview
            ? "Files and related resources stay with this ticket when it moves between panels."
            : "Opened from this ticket’s navigation. Switch tabs or move the ticket: this selection stays with it."}
        </Text>
        <Stack gap="sm">
          <Text textStyle="label/S/medium">{isOverview ? "Description" : "Notes"}</Text>
          <Textarea
            aria-label={`${ticket.id} draft`}
            value={state.draft}
            onChange={(event) => update({ draft: event.target.value })}
            minH="32"
          />
          <Text textStyle="label/XS" color="fg.muted">
            Draft saved in this preview
          </Text>
        </Stack>
      </Stack>
    </ScrollArea>
  );
};

export const CollectionContent = () => (
  <Stack p="lg" gap="lg" minW="0">
    <Text textStyle="heading/M">Project timeline</Text>
    <Text color="fg.muted">Your project stays in Main while you work on a ticket in another panel.</Text>
    {tickets.map((ticket) => (
      <Box key={ticket.id} borderWidth="1px" borderColor="border.subtle" borderRadius="xs" p="md">
        <Text textStyle="label/XS" color="fg.muted">
          {ticket.id}
        </Text>
        <Text textStyle="label/M/medium">{ticket.title}</Text>
      </Box>
    ))}
  </Stack>
);

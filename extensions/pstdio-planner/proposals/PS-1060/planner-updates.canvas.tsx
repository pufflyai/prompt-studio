import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { buildTracks } from "../../src/timeline/model/tracks";
import { relationsFor } from "../../src/timeline/view/plan-state";
import { TimelinePresentationProvider } from "../../src/timeline/view/timeline-presentation";
import { GanttView } from "./gantt-view";
import { PlanGraph } from "./plan-graph";
import { PlanHeader } from "./plan-header";
import { headerData, plan } from "./planner-fixture";
import { PlannerNavigation } from "./planner-navigation";

function PlannerPrototype(props: { initialView?: "tree" | "gantt"; autoBuildOpen?: boolean; selected?: string }) {
  const [view, setView] = useState(props.initialView ?? "tree");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(props.selected);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const rows = plan.sections.flatMap(({ rows }) => rows);
  const filtered = rows.filter(({ title }) => title.toLowerCase().includes(search.toLowerCase()));
  const relations = relationsFor(
    rows.find(({ id }) => id === selectedId),
    plan,
  );
  return (
    <TimelinePresentationProvider projectId={`PS-1060-${props.initialView}-${props.selected}`}>
      <Flex w="full" h="3xl" bg="bg" color="fg" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <PlannerNavigation defaultOpen={props.autoBuildOpen} />
        <Stack flex="1" minW="0" minH="0" gap="0">
          <HStack px="md" py="sm" borderBottomWidth="1px" borderColor="border.subtle">
            <Text textStyle="label/S/medium">Project Timeline</Text>
          </HStack>
          <Box px="sm" py="xs">
            <PlanHeader
              data={headerData}
              search={search}
              onSearchChange={setSearch}
              resultLabel={`${filtered.length} of ${rows.length}`}
              view={view}
              onViewChange={setView}
            />
          </Box>
          {view === "gantt" ? (
            <GanttView search={search} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <Box flex="1" minH="0">
              <PlanGraph
                sections={plan.sections.map((section) => ({
                  section,
                  rows: section.rows.filter(({ id }) => filtered.some((row) => row.id === id)),
                  collapsed: collapsed.includes(section.deadline!.id),
                }))}
                tracks={buildTracks(undefined, rows)}
                today={plan.today}
                selectedId={selectedId}
                relations={relations}
                onSelect={(id) => setSelectedId(id === selectedId ? undefined : id)}
                onToggle={(id) => {
                  if (id)
                    setCollapsed(
                      collapsed.includes(id) ? collapsed.filter((value) => value !== id) : [...collapsed, id],
                    );
                }}
                onContext={() => {}}
                onDragStart={() => {}}
                onDragTarget={() => {}}
                onDrop={() => {}}
                onDelete={() => {}}
                onRenameDeadline={async () => {}}
                onRedate={async () => {}}
                onRenameTrack={async () => {}}
                onReview={() => {}}
                onNewTrack={() => {}}
                onCreateDeadline={() => {}}
              />
            </Box>
          )}
        </Stack>
      </Flex>
    </TimelinePresentationProvider>
  );
}

export default {
  title: "Proposals/PS-1060 Planner navigation and timeline",
  fullscreen: true,
  description:
    "Synthetic interactive proposal. Open Auto Build in Project Planning; use Display to switch Tree/Gantt. Milestone ETAs accumulate to 7h, 9h, and 12h. No real tickets or runs are changed.",
} satisfies CanvasMeta;

export const TreeView = () => <PlannerPrototype />;
export const SelectedDependencies = () => <PlannerPrototype selected="preview" />;
export const GanttViewPreview = () => <PlannerPrototype initialView="gantt" />;
export const AutoBuildPopover = () => <PlannerPrototype initialView="gantt" autoBuildOpen />;

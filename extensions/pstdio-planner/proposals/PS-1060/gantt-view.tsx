import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal, ScrollArea } from "@pstdio/ui";
import { GanttChart, type GanttTask } from "@pstdio/ui/charts";
import { useCollectionViewStore } from "@pstdio/ui/collection-view";
import { CollectionBadge } from "@pstdio/ui/kanban-renderer";
import { useState } from "react";
import { timelineInitialState } from "../../src/timeline/view/timeline-query";
import { headerData, milestones, tickets } from "./planner-fixture";

interface GanttViewProps {
  search: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

let offset = 0;
const tasks: GanttTask[] = tickets.map((ticket) => {
  const start = offset;
  offset += ticket.hours;
  return {
    id: ticket.id,
    label: ticket.title,
    group: ticket.milestone,
    start,
    end: offset,
    dependsOn: ticket.dependsOn,
  };
});
let milestoneOffset = 0;
const markers = milestones.map((milestone) => {
  milestoneOffset += milestone.hours;
  return { id: milestone.id, label: milestone.name, value: milestoneOffset };
});

function TicketBadges({ task }: { task: GanttTask }) {
  const properties = useCollectionViewStore(
    headerData.storageKey,
    timelineInitialState,
    (state) => state.settings.displayProperties,
  );
  const ticket = tickets.find(({ id }) => id === task.id)!;
  return (
    <HStack gap="2xs">
      <CollectionBadge label={ticket.shorthand} />
      {properties.includes("status") ? (
        <CollectionBadge label={ticket.status} color={ticket.status === "Done" ? "green" : "blue"} />
      ) : null}
      {properties.includes("priority") ? <CollectionBadge label={ticket.priority} color="orange" /> : null}
    </HStack>
  );
}

export function GanttView({ search, selectedId, onSelect }: GanttViewProps) {
  const [openedId, setOpenedId] = useState<string>();
  const opened = tickets.find(({ id }) => id === openedId);
  const query = search.toLowerCase();
  const shown = tasks.filter((task) => !query || task.label.toLowerCase().includes(query));
  return (
    <>
      <ScrollArea flex="1" minH="0">
        <Box p="md" minW="4xl">
          <GanttChart
            tasks={shown}
            milestones={markers}
            ariaLabel="Project tickets and milestone dependencies"
            formatValue={(value) => `${Number(value.toFixed(1))}h`}
            now={0}
            selectedId={selectedId}
            onSelect={onSelect}
            TaskBadges={TicketBadges}
            onOpen={(id) => {
              onSelect(id);
              setOpenedId(id);
            }}
          />
        </Box>
      </ScrollArea>
      <Dialog.Root
        open={Boolean(opened)}
        onOpenChange={({ open }) => {
          if (!open) setOpenedId(undefined);
        }}
        placement="center"
        lazyMount
        unmountOnExit
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{opened?.title}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {opened ? (
                  <Stack gap="md">
                    <HStack gap="xs">
                      <CollectionBadge label={opened.shorthand} />
                      <CollectionBadge label={opened.status} color="blue" />
                      <CollectionBadge label={opened.priority} color="orange" />
                    </HStack>
                    <Text>{opened.description}</Text>
                    <Text textStyle="label/S/regular">
                      {milestones.find(({ id }) => id === opened.milestone)?.name} · {opened.hours}h
                    </Text>
                    {opened.dependsOn.length ? (
                      <Stack gap="xs">
                        <Text textStyle="label/S/medium">Depends on</Text>
                        {opened.dependsOn.map((id) => (
                          <Button key={id} variant="ghost" size="sm" onClick={() => setOpenedId(id)}>
                            {tickets.find((ticket) => ticket.id === id)?.title}
                          </Button>
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                ) : null}
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" size="sm" onClick={() => setOpenedId(undefined)}>
                  Close
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}

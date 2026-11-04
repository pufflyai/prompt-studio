import { HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { GanttChart, type GanttTask } from "@pstdio/ui/charts";
import { milestones, tickets } from "./planner-fixture";

interface GanttViewProps {
  search: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

const tasks: GanttTask[] = [];
let offset = 0;
for (const milestone of milestones) {
  const end = offset + milestone.hours;
  const group = `${milestone.name} · ETA ~${end}h`;
  const children = tickets.filter((ticket) => ticket.milestone === milestone.id);
  for (const ticket of children) {
    tasks.push({
      id: ticket.id,
      label: ticket.title,
      group,
      start: offset,
      end: offset + ticket.hours,
      dependsOn: ticket.dependsOn,
    });
    offset += ticket.hours;
  }
  tasks.push({
    id: `${milestone.id}:complete`,
    label: `${milestone.name} complete`,
    group,
    start: end,
    end,
    dependsOn: children.map(({ id }) => id),
  });
}

export function GanttView({ search, selectedId, onSelect }: GanttViewProps) {
  const query = search.toLowerCase();
  const shown = tasks.filter((task) => !query || task.label.toLowerCase().includes(query));
  return (
    <ScrollArea flex="1" minH="0">
      <Stack gap="sm" p="md" minW="3xl">
        <HStack justify="space-between">
          <Text textStyle="label/S/medium">Forecast from now</Text>
          <Text textStyle="label/XS/regular" color="fg.muted">
            Hours · project pace
          </Text>
        </HStack>
        <GanttChart
          tasks={shown}
          ariaLabel="Project milestone forecast and dependencies"
          formatValue={(value) => `${Number(value.toFixed(1))}h`}
          now={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
        <HStack gap="md" flexWrap="wrap">
          {milestones.map((milestone) => (
            <Text key={milestone.id} textStyle="label/XS/regular" color="fg.muted">
              {milestone.name} due {milestone.date}
            </Text>
          ))}
        </HStack>
      </Stack>
    </ScrollArea>
  );
}

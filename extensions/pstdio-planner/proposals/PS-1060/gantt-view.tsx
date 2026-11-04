import { Box, Button, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea, Tooltip } from "@pstdio/ui";
import { Diamond } from "lucide-react";
import { milestones, tickets } from "./planner-fixture";

interface GanttViewProps {
  search: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

// The forecast uses a relative hour axis; milestone dates remain due dates.
export function GanttView({ search, selectedId, onSelect }: GanttViewProps) {
  let offset = 0;
  return (
    <ScrollArea flex="1" minH="0">
      <Stack gap="0" minW="4xl" p="md">
        <HStack justify="space-between" pb="md">
          <Text textStyle="label/S/medium">Forecast from now</Text>
          <Text textStyle="label/XS/regular" color="fg.muted">
            Hours · project pace
          </Text>
        </HStack>
        <Grid
          templateColumns="{sizes.xs} repeat(12, minmax(0, 1fr))"
          gap="0"
          pb="sm"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          <Text textStyle="label/XS/medium" color="fg.muted">
            Milestones and tickets
          </Text>
          {Array.from({ length: 12 }, (_, i) => (
            <Text key={i} textStyle="label/XS/regular" color="fg.muted">
              {i === 0 ? "Now" : `${i}h`}
            </Text>
          ))}
        </Grid>
        {milestones.map((milestone) => {
          const start = offset;
          offset += milestone.hours;
          const end = offset;
          let ticketOffset = start;
          const rows = tickets
            .filter((ticket) => ticket.milestone === milestone.id)
            .map((ticket) => {
              const from = ticketOffset;
              ticketOffset += ticket.hours;
              return { ...ticket, from };
            });
          return (
            <Stack key={milestone.id} gap="xs" py="md" borderBottomWidth="1px" borderColor="border.subtle">
              <Grid templateColumns="{sizes.xs} repeat(12, minmax(0, 1fr))" alignItems="center">
                <Stack gap="2xs">
                  <Text textStyle="label/S/medium">{milestone.name}</Text>
                  <Text textStyle="label/XS/regular" color="fg.muted">
                    Due {milestone.date} · ETA ~{end}h
                  </Text>
                </Stack>
                <Tooltip
                  content={`${milestone.name}: ${milestone.hours}h of work; completes in approximately ${end}h including earlier milestones.`}
                >
                  <Button
                    gridColumn={`${start + 2} / span ${milestone.hours}`}
                    size="xs"
                    variant="outline"
                    justifyContent="space-between"
                    aria-label={`${milestone.name}, ETA ${end} hours`}
                  >
                    {milestone.hours}h <Diamond />
                  </Button>
                </Tooltip>
              </Grid>
              {rows
                .filter(({ title }) => title.toLowerCase().includes(search.toLowerCase()))
                .map((ticket) => (
                  <Grid
                    key={ticket.id}
                    templateColumns="{sizes.xs} repeat(12, minmax(0, 1fr))"
                    alignItems="center"
                    minH="10"
                  >
                    <Text textStyle="label/XS/regular" color="fg.muted" pr="md">
                      {ticket.title}
                    </Text>
                    <Tooltip
                      content={`${ticket.title} · ${ticket.hours}h${ticket.dependsOn.length ? " · after its dependency" : ""}`}
                    >
                      <Button
                        gridColumn={`${ticket.from + 2} / span ${ticket.hours}`}
                        size="xs"
                        variant={selectedId === ticket.id ? "solid" : "subtle"}
                        aria-pressed={selectedId === ticket.id}
                        onClick={() => onSelect(ticket.id)}
                      >
                        {ticket.hours}h
                      </Button>
                    </Tooltip>
                  </Grid>
                ))}
            </Stack>
          );
        })}
        <Box pt="md">
          <Text textStyle="label/XS/regular" color="fg.muted">
            ETA ~7h → ~9h → ~12h
          </Text>
        </Box>
      </Stack>
    </ScrollArea>
  );
}

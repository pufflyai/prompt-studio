import { Box, Button, Flex, Grid, GridItem, Stack, Text } from "@chakra-ui/react";
import { Chip, ScrollArea, SegmentedControl, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { DataTable } from "@pstdio/ui/data-table";
import { useState } from "react";
import type { Condition } from "./fixtures";
import { HealthTimeline, SeriesChart } from "./visual-charts";
import {
  healthIntervals,
  observedTime,
  type Panel,
  panels,
  panelsFor,
  seriesFor,
  type VisualSection,
  type WindowRange,
} from "./visual-data";

interface VisualMonitorProps {
  condition: Condition;
}
interface PanelCardProps {
  panel: Panel;
  condition: Condition;
  range: WindowRange;
  environment: string;
  onInspect: (id: string) => void;
}

const PanelCard = ({ panel, condition, range, environment, onInspect }: PanelCardProps) => {
  const points = seriesFor(panel, condition, range, environment);
  const noCurrentCapacity = panel.kind === "capacity" && condition === "stale";
  return (
    <SimpleCard minW="0">
      <SimpleCardBody>
        <Stack gap="sm">
          <Flex justify="space-between" gap="sm" align="center">
            <Text textStyle="label/M/medium">{panel.title}</Text>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => onInspect(panel.id)}
              aria-label={`Inspect ${panel.title.toLowerCase()} data`}
            >
              Inspect data
            </Button>
          </Flex>
          {noCurrentCapacity ? (
            <Box h="3xs">
              <Text textStyle="body/S" color="fg.muted">
                Current capacity is unknown. Last observation: 12 min ago.
              </Text>
            </Box>
          ) : (
            <SeriesChart panel={panel} points={points} range={range} />
          )}
          {panel.kind === "capacity" && (
            <Text textStyle="label/XS/regular" color="fg.muted">
              Warning threshold: 80% used
            </Text>
          )}
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

const Detail = ({
  selected,
  condition,
  range,
  environment,
  onClose,
}: {
  selected: string;
  condition: Condition;
  range: WindowRange;
  environment: string;
  onClose: () => void;
}) => {
  const panel = panels.find(({ id }) => id === selected);
  const rows = panel
    ? seriesFor(panel, condition, range, environment).map((point, index) => ({
        id: String(index),
        observed: observedTime(point.time),
        series: point.series,
        value: point.value ?? "Unknown",
        unit: panel.unit,
      }))
    : healthIntervals(condition, range).map((point, index) => ({
        id: String(index),
        observed: observedTime(point.start),
        check: point.check,
        state: point.state,
      }));
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="sm">
          <Flex justify="space-between" align="center">
            <Text textStyle="label/M/medium">{panel?.title ?? "Health timeline"} · exact observations</Text>
            <Button size="xs" variant="ghost" onClick={onClose}>
              Close details
            </Button>
          </Flex>
          <DataTable
            data={rows}
            hiddenColumns={["id"]}
            getRowId={(row) => String(row.id)}
            defaultSettings={{ rowNumbers: false }}
            itemLabel="observation"
          />
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

export const VisualMonitor = ({ condition }: VisualMonitorProps) => {
  const [environment, setEnvironment] = useState("Production");
  const [range, setRange] = useState<WindowRange>("24h");
  const [section, setSection] = useState<VisualSection>("Overview");
  const [selected, setSelected] = useState<string>();
  const [connectedCondition, setConnectedCondition] = useState<Condition>();
  const [refreshed, setRefreshed] = useState(false);
  const effectiveCondition = connectedCondition === condition ? "healthy" : condition;
  const stale = effectiveCondition === "stale";
  const needsConnection = ["setup", "disconnected"].includes(effectiveCondition);
  const status = {
    healthy: "Healthy",
    "storage-failure": "Storage checks failing",
    stale: "Unknown",
    disconnected: "Query unavailable",
    setup: "Not connected",
  }[effectiveCondition];
  return (
    <Flex h="100dvh" direction="column" overflow="hidden" bg="bg" color="fg">
      <Stack p="md" gap="sm" flexShrink={0}>
        <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
          <Flex align="center" gap="sm">
            <Text textStyle="heading/M">Relay monitoring</Text>
            <Chip>{status}</Chip>
          </Flex>
          <SegmentedControl
            aria-label="Environment"
            value={environment}
            onValueChange={setEnvironment}
            options={["Production", "Staging"].map((value) => ({ value, label: value }))}
          />
        </Flex>
        <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
          <SegmentedControl
            aria-label="Monitoring section"
            value={section}
            onValueChange={(value) => setSection(value as VisualSection)}
            options={["Overview", "Sync", "Storage", "Infrastructure", "Failures"].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Flex align="center" gap="sm">
            <SegmentedControl
              aria-label="Time range"
              value={range}
              onValueChange={(value) => setRange(value as WindowRange)}
              options={["1h", "24h", "7d"].map((value) => ({ value, label: value }))}
            />
            <Button size="xs" variant="ghost" onClick={() => setRefreshed(true)}>
              Refresh
            </Button>
          </Flex>
        </Flex>
        <Text textStyle="label/XS/regular" color="fg.muted">
          {environment} ·{" "}
          {stale ? "Last observation 12 min ago · current health unknown" : "Last observation 20 sec ago"}
          {refreshed ? " · Query refreshed" : ""}
        </Text>
      </Stack>
      <ScrollArea flex="1" minH="0">
        <Stack p="md" gap="md">
          {needsConnection ? (
            <SimpleCard>
              <SimpleCardBody>
                <Stack gap="sm">
                  <Text textStyle="heading/S">
                    {condition === "setup" ? "Connect monitoring" : "Query connection unavailable"}
                  </Text>
                  <Text textStyle="body/S">
                    Use the read-only connection in Prompt Studio settings. Server collection and alerting continue
                    independently.
                  </Text>
                  <Button size="sm" alignSelf="flex-start" onClick={() => setConnectedCondition(condition)}>
                    {condition === "setup" ? "Check connection" : "Retry connection"}
                  </Button>
                </Stack>
              </SimpleCardBody>
            </SimpleCard>
          ) : (
            <>
              <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap="md">
                <GridItem colSpan={{ base: 1, lg: 2 }} minW="0">
                  <SimpleCard>
                    <SimpleCardBody>
                      <Stack gap="sm">
                        <Flex justify="space-between" align="center" gap="sm">
                          <Stack gap="2xs">
                            <Text textStyle="label/M/medium">Health over time</Text>
                            <Text textStyle="label/XS/regular" color="fg.muted">
                              {status} · hover or focus an interval for its state
                            </Text>
                          </Stack>
                          <Button size="xs" variant="ghost" onClick={() => setSelected("health")}>
                            Inspect health data
                          </Button>
                        </Flex>
                        <HealthTimeline condition={effectiveCondition} range={range} />
                      </Stack>
                    </SimpleCardBody>
                  </SimpleCard>
                </GridItem>
                {panelsFor(section).map((panel) => (
                  <PanelCard
                    key={panel.id}
                    panel={panel}
                    condition={effectiveCondition}
                    range={range}
                    environment={environment}
                    onInspect={setSelected}
                  />
                ))}
              </Grid>
              {selected && (
                <Detail
                  selected={selected}
                  condition={effectiveCondition}
                  range={range}
                  environment={environment}
                  onClose={() => setSelected(undefined)}
                />
              )}
              <Flex gap="sm" wrap="wrap">
                <Chip>Backup evidence: Not configured</Chip>
                <Chip>1 relay instance expected</Chip>
                <Chip>{stale ? "Certificate observation stale" : "Certificate expires in 62 days"}</Chip>
              </Flex>
              <Text textStyle="label/XS/regular" color="fg.muted">
                Synthetic proposal preview · gaps mean missing observations · percentage bars show used capacity
              </Text>
            </>
          )}
        </Stack>
      </ScrollArea>
    </Flex>
  );
};

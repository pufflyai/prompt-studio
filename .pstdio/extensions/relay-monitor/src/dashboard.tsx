import { Button, Flex, Grid, GridItem, Stack, Text } from "@chakra-ui/react";
import { Chip, ScrollArea, SegmentedControl, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { DataTable } from "@pstdio/ui/data-table";
import { useState } from "react";
import { HealthTimeline, SeriesChart } from "./charts";
import type { Section, Snapshot, WindowRange } from "./model";

export interface DashboardProps {
  snapshot?: Snapshot;
  error?: string;
  loading: boolean;
  range: WindowRange;
  section: Section;
  onRange: (value: WindowRange) => void;
  onSection: (value: Section) => void;
  onRefresh: () => void;
  failures?: { timestamp: string; code: string }[];
  onFailures?: () => void;
  onOlder?: () => void;
  failuresNote?: string;
}
const observed = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString() : "No observation";
export const Dashboard = (props: DashboardProps) => {
  const { snapshot, range, section, loading } = props;
  const [selected, setSelected] = useState<string>();
  const current = snapshot?.range === range && snapshot.section === section ? snapshot : undefined;
  const panel = current?.panels.find(({ id }) => id === selected);
  const rows = detailRows(current, selected);
  const stale = current && Date.now() / 1000 - current.queriedAt > 90;
  const state = props.error || stale ? "Unknown" : summary(current);
  return (
    <Flex h="100dvh" minH="0" direction="column" overflow="hidden" bg="bg" color="fg">
      <Stack p="md" gap="sm" flexShrink={0}>
        {current?.message && current.connection === "connected" && (
          <Text textStyle="body/S" role="alert">
            {current.message}
          </Text>
        )}
        <Flex justify="space-between" gap="sm" wrap="wrap" align="center">
          <Chip>{state}</Chip>
        </Flex>
        <Flex justify="space-between" gap="sm" wrap="wrap" align="center">
          <SegmentedControl
            aria-label="Monitoring section"
            value={section}
            onValueChange={(value) => {
              setSelected(undefined);
              props.onSection(value as Section);
            }}
            options={["Overview", "Sync", "Storage", "Infrastructure", "Failures"].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Flex gap="sm" align="center">
            <SegmentedControl
              aria-label="Time range"
              value={range}
              onValueChange={(value) => props.onRange(value as WindowRange)}
              options={["1h", "24h", "7d"].map((value) => ({ value, label: value }))}
            />
            <Button size="xs" variant="ghost" onClick={props.onRefresh} disabled={loading}>
              {loading ? "Querying…" : "Refresh"}
            </Button>
          </Flex>
        </Flex>
        <Text textStyle="label/XS/regular" color="fg.muted">
          UTC · Query: {observed(current?.queriedAt)} · collection and alerts run independently
        </Text>
        {props.error && (
          <Text role="alert" textStyle="body/S">
            {props.error} · displayed observations have not been refreshed
          </Text>
        )}
      </Stack>
      <ScrollArea flex="1" minH="0">
        <Stack p="md" gap="md">
          {current?.connection === "unavailable" && (
            <SimpleCard>
              <SimpleCardBody>
                <Text>{current.message}</Text>
              </SimpleCardBody>
            </SimpleCard>
          )}
          {!current && <Text>{loading ? "Loading observations…" : "No observations available"}</Text>}
          {current?.connection === "connected" && (
            <>
              <Grid templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap="md">
                <GridItem colSpan={{ base: 1, lg: 2 }} minW="0">
                  <SimpleCard>
                    <SimpleCardBody>
                      <Stack gap="sm">
                        <Flex justify="space-between" align="center" gap="sm">
                          <Text textStyle="label/M/medium">Health over time</Text>
                          <Button size="xs" variant="ghost" onClick={() => setSelected("health")}>
                            Inspect health data
                          </Button>
                        </Flex>
                        <HealthTimeline intervals={current.health} domain={[current.start, current.end]} />
                      </Stack>
                    </SimpleCardBody>
                  </SimpleCard>
                </GridItem>
                {current.panels.map((item) => (
                  <SimpleCard key={item.id} minW="0">
                    <SimpleCardBody>
                      <Stack gap="sm">
                        <Flex justify="space-between" align="center" gap="sm">
                          <Text textStyle="label/M/medium">{item.title}</Text>
                          <Button
                            size="xs"
                            variant="ghost"
                            aria-label={`Inspect ${item.title.toLowerCase()} data`}
                            onClick={() => setSelected(item.id)}
                          >
                            Inspect data
                          </Button>
                        </Flex>
                        {item.error || !item.points.some((point) => point.value !== null) ? (
                          <Flex h="3xs" align="center">
                            <Text textStyle="body/S" color="fg.muted">
                              {item.error ?? "No fresh observations · configure this source or inspect its collector"}
                            </Text>
                          </Flex>
                        ) : (
                          <SeriesChart panel={item} domain={[current.start, current.end]} />
                        )}
                        {item.kind === "capacity" && (
                          <Text textStyle="label/XS/regular" color="fg.muted">
                            Warning threshold: 80% used
                          </Text>
                        )}
                      </Stack>
                    </SimpleCardBody>
                  </SimpleCard>
                ))}
              </Grid>
              <Flex gap="sm" align="center" wrap="wrap">
                <Button size="xs" variant="ghost" onClick={() => setSelected("checks")}>
                  Inspect all 13 checks
                </Button>
                <Chip>Backup: {current.checks.find((check) => check.id === "backup")?.state ?? "unknown"}</Chip>
              </Flex>
              {selected && (
                <SimpleCard>
                  <SimpleCardBody>
                    <Stack gap="sm">
                      <Flex justify="space-between">
                        <Text textStyle="label/M/medium">
                          {panel?.title ?? (selected === "checks" ? "Check observations" : "Health intervals")}
                        </Text>
                        <Button size="xs" variant="ghost" onClick={() => setSelected(undefined)}>
                          Close details
                        </Button>
                      </Flex>
                      <DataTable
                        data={rows ?? []}
                        hiddenColumns={["id"]}
                        getRowId={(row) => String(row.id)}
                        defaultSettings={{ rowNumbers: false }}
                        itemLabel="observation"
                      />
                    </Stack>
                  </SimpleCardBody>
                </SimpleCard>
              )}
              {section === "Failures" && <FailureDetails {...props} />}
              <Text textStyle="label/XS/regular" color="fg.muted">
                Gaps mean missing observations. Latency curves show the maximum of recorded p50/p95/p99 in each bin.
                Storage covers explicitly configured account aliases.
              </Text>
            </>
          )}
        </Stack>
      </ScrollArea>
    </Flex>
  );
};

const summary = (current?: Snapshot) => {
  if (!current || current.connection !== "connected") return "Unknown";
  if (current.checks.some((check) => check.state === "critical")) return "Checks failing";
  if (current.checks.some((check) => ["unknown", "not-configured", "unsupported"].includes(check.state)))
    return "Incomplete observations";
  if (current.checks.some((check) => check.state === "warning")) return "Warning";
  return "Healthy";
};
const detailRows = (current?: Snapshot, selected?: string) => {
  if (selected === "checks")
    return current?.checks.map((check) => ({ ...check, observedAt: observed(check.observedAt) }));
  if (selected === "health")
    return current?.health.map((interval, index) => ({
      id: String(index),
      ...interval,
      start: observed(interval.start),
      end: observed(interval.end),
    }));
  const panel = current?.panels.find(({ id }) => id === selected);
  return panel?.points.map((point, index) => ({
    id: String(index),
    ...point,
    time: observed(point.time),
    value: point.value ?? "Unknown",
    unit: panel.unit,
  }));
};

const FailureDetails = (props: DashboardProps) => (
  <SimpleCard>
    <SimpleCardBody>
      <Stack gap="sm">
        <Flex justify="space-between">
          <Text textStyle="label/M/medium">Redacted operation failures · 200 per page</Text>
          <Button size="xs" variant="ghost" onClick={props.onFailures}>
            Load failures
          </Button>
        </Flex>
        {props.failures && (
          <DataTable
            data={props.failures.map((failure, index) => ({
              id: String(index),
              observedAt: observed(Number(BigInt(failure.timestamp) / 1_000_000_000n)),
              code: failure.code,
            }))}
            hiddenColumns={["id"]}
            getRowId={(row) => String(row.id)}
            defaultSettings={{ rowNumbers: false }}
            itemLabel="failure"
          />
        )}
        {props.onOlder && (
          <Button size="xs" variant="ghost" alignSelf="flex-start" onClick={props.onOlder}>
            Older failures
          </Button>
        )}
        {props.failuresNote && <Text textStyle="body/S">{props.failuresNote}</Text>}
      </Stack>
    </SimpleCardBody>
  </SimpleCard>
);

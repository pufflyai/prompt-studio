import { Box, Button, HStack, Icon, IconButton, Stack, Tabs, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState } from "@pstdio/ui";
import { DataTable, type RowData } from "@pstdio/ui/data-table";
import { CalendarDays, Github, Layers } from "lucide-react";
import { useState } from "react";
import { PageFrame } from "../webview/page-frame";
import { type Aggregation, aggregationOptions, type DateRange, rangeOptions } from "../webview/period";
import { SelectMenu } from "../webview/select-menu";
import { BugOriginsPlot } from "./bug-origins-plot";
import { CategoryBreakdown, formatDuration, ReleaseRunPlots } from "./health-charts";
import { buildHealthTimeline } from "./health-timeline";
import { PullRequestMergesPlot } from "./pull-request-merges-plot";
import { ReleaseEtaPlot } from "./release-eta-plot";
import type { HealthHistory, ReleaseHealth } from "./types";

// Release health can be grouped by hour over the last 7 days; longer ranges would draw thousands of bars.
const HOURLY_RANGE: DateRange = "7";
const hourOption = { value: "hour", label: "Hour" } satisfies (typeof aggregationOptions)[number];
const healthAggregationOptions = (range: DateRange) =>
  range === HOURLY_RANGE ? [hourOption, ...aggregationOptions] : aggregationOptions;

export interface HealthViewProps extends HealthHistory {
  today: string;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (url: string) => void;
}

const RunsTable = (props: {
  runs: ReleaseHealth[];
  selected?: ReleaseHealth;
  onChoose: (id: number) => void;
  onOpen: (url: string) => void;
}) => {
  const { runs, selected, onChoose, onOpen } = props;
  const rows: RowData[] = [...runs].reverse().map((run) => ({
    id: run.id,
    run: `${new Date(run.createdAt).toLocaleString()} · ${run.sha.slice(0, 7)}`,
    verification: run.status === "completed" ? (run.conclusion ?? "—") : run.status.replaceAll("_", " "),
    passed: run.counts.reports ? run.counts.passed.toLocaleString() : "—",
    failed: run.counts.reports ? run.counts.failed.toLocaleString() : "—",
    duration: run.runDurationSeconds === undefined ? "—" : formatDuration(run.runDurationSeconds),
    evidence: `${run.reportedJobs}/${run.testJobs} test jobs${run.pendingJobs ? ` · ${run.pendingJobs} pending` : ""}`,
    publication: run.published ? "Published" : "Unpublished",
    github: (
      <IconButton
        aria-label={`Open run ${run.id} on GitHub`}
        size="2xs"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(run.url);
        }}
      >
        <Icon as={Github} boxSize="14px" />
      </IconButton>
    ),
  }));
  return (
    <DataTable
      data={rows}
      hiddenColumns={["id"]}
      getRowId={(row) => String(row.id)}
      initialPageSize={10}
      defaultSettings={{ rowNumbers: false }}
      compactHeaders={{
        run: "Run",
        verification: "Verification",
        passed: "Passed",
        failed: "Failed",
        duration: "Duration",
        evidence: "Evidence",
        publication: "Publication",
        github: "",
      }}
      columnIcons={{ github: <Icon as={Github} boxSize="14px" /> }}
      filterableColumns={["run", "verification", "publication"]}
      activeRowId={selected ? String(selected.id) : null}
      enableRowActivation
      onRowClick={(row) => onChoose(Number(row.id))}
      toolbarStorageKey="release-health-runs"
      itemLabel="run"
    />
  );
};

const RunDetail = (props: { run: ReleaseHealth; onOpen: (url: string) => void }) => {
  const { run, onOpen } = props;
  return (
    <Stack gap="sm">
      <HStack>
        <Text textStyle="label/M/medium">
          Run {run.id}, attempt {run.attempt}
        </Text>
        <Button size="xs" variant="ghost" onClick={() => onOpen(run.url)}>
          Open on GitHub
        </Button>
      </HStack>
      <CategoryBreakdown run={run} />
      {run.failedJobs.map((job) => (
        <Button
          key={job.url}
          size="xs"
          variant="ghost"
          justifyContent="flex-start"
          color="fg.error"
          onClick={() => onOpen(job.url)}
        >
          {job.name}
        </Button>
      ))}
      {run.errors.length ? (
        <AlertMessage status="warning" title="Some test evidence is unavailable">
          {run.errors.join("\n")}
        </AlertMessage>
      ) : null}
      <Text textStyle="label/S/regular" color="fg.muted">
        {run.counts.skipped.toLocaleString()} skipped or unrun tests.{" "}
        {run.testJobs - run.reportedJobs - run.pendingJobs} finished test jobs without summaries.
      </Text>
    </Stack>
  );
};

export const HealthView = (props: HealthViewProps) => {
  const {
    today,
    runs,
    pullRequestMerges,
    pullRequestMergesDaily,
    pullRequestMergesHourly,
    pullRequestMergesError,
    bugOriginCoverage,
    publications,
    publicationsError,
    error,
    refreshing,
    onRefresh,
    onOpen,
  } = props;
  const [tab, setTab] = useState("overview");
  const [chosen, setChosen] = useState<number>();
  const [range, setRange] = useState<DateRange>("30");
  const [chosenAggregation, setAggregation] = useState<Aggregation>("day");
  const aggregation = chosenAggregation === "hour" && range !== HOURLY_RANGE ? "day" : chosenAggregation;
  const { buckets, selectedRuns } = buildHealthTimeline({
    today,
    range,
    aggregation,
    runs,
    merges: pullRequestMergesDaily ?? pullRequestMerges ?? [],
    hourlyMerges: pullRequestMergesHourly,
    publications: publications ?? [],
  });
  const selected = selectedRuns.find((run) => run.id === chosen) ?? selectedRuns.at(-1);
  const emptyTitle = runs.length ? "No release runs in this range" : "No release results yet";
  const empty = <EmptyState title={refreshing && !runs.length ? "Collecting release results" : emptyTitle} />;
  return (
    <Tabs.Root
      value={tab}
      onValueChange={(details) => setTab(details.value)}
      size="sm"
      h="full"
      minH="0"
      display="flex"
      flexDirection="column"
    >
      <PageFrame
        headerPadding="xs"
        contentPadding={tab === "runs" ? "none" : "lg"}
        toolbar={
          <>
            <Tabs.List>
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="runs">Runs</Tabs.Trigger>
            </Tabs.List>
            <SelectMenu
              label="Range"
              icon={<CalendarDays />}
              value={range}
              options={rangeOptions}
              onValueChange={(value) => setRange(value as DateRange)}
            />
            {tab === "overview" ? (
              <SelectMenu
                label="Aggregation"
                icon={<Layers />}
                value={aggregation}
                options={healthAggregationOptions(range)}
                onValueChange={(value) => setAggregation(value as Aggregation)}
              />
            ) : null}
            <Button size="xs" variant="ghost" loading={refreshing} onClick={onRefresh} ml="auto">
              Refresh
            </Button>
          </>
        }
      >
        {error ? (
          <AlertMessage status="error" title="Release results could not be refreshed">
            {error}
          </AlertMessage>
        ) : null}
        <Tabs.Content value="overview">
          <Stack gap="lg">
            {publicationsError ? (
              <AlertMessage status="warning" title="Release dates could not be refreshed">
                {publicationsError}
              </AlertMessage>
            ) : null}
            {buckets.some((bucket) => bucket.publications.length) ? (
              <HStack color="fg.muted" gap="xs">
                <Box w="4" borderTopWidth="1px" borderTopStyle="dashed" borderColor="currentColor" />
                <Text textStyle="label/XS">Published pstdio releases · UTC</Text>
              </HStack>
            ) : null}
            {selectedRuns.length ? (
              <ReleaseEtaPlot runs={selectedRuns} grouping={aggregation} onChoose={setChosen} />
            ) : null}
            <PullRequestMergesPlot buckets={buckets} aggregation={aggregation} error={pullRequestMergesError} />
            {bugOriginCoverage ? (
              <BugOriginsPlot buckets={buckets} aggregation={aggregation} coverage={bugOriginCoverage} />
            ) : null}
            {!selectedRuns.length ? (
              empty
            ) : (
              <ReleaseRunPlots buckets={buckets} aggregation={aggregation} onChoose={setChosen} />
            )}
          </Stack>
        </Tabs.Content>
        <Tabs.Content value="runs">
          {!selectedRuns.length ? (
            empty
          ) : (
            <Stack gap="lg">
              <Box h="32rem" minW="0" overflow="hidden">
                <RunsTable runs={selectedRuns} selected={selected} onChoose={setChosen} onOpen={onOpen} />
              </Box>
              {selected ? (
                <Box px="lg" pb="lg">
                  <RunDetail run={selected} onOpen={onOpen} />
                </Box>
              ) : null}
            </Stack>
          )}
        </Tabs.Content>
      </PageFrame>
    </Tabs.Root>
  );
};

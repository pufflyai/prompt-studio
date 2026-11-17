import { Box, Button, HStack, Icon, IconButton, Stack, Tabs, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState } from "@pstdio/ui";
import { DataTable, type RowData } from "@pstdio/ui/data-table";
import { Github } from "lucide-react";
import { useState } from "react";
import { PageFrame } from "../webview/page-frame";
import {
  CategoryBreakdown,
  DurationPlot,
  formatDuration,
  HealthPlot,
  hasCategories,
  quarantinedTests,
  TotalTestsPlot,
} from "./health-charts";
import type { HealthHistory, ReleaseHealth } from "./types";

export interface HealthViewProps extends HealthHistory {
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
  const { runs, error, refreshing, onRefresh, onOpen } = props;
  const [tab, setTab] = useState("overview");
  const [chosen, setChosen] = useState<number>();
  const selected = runs.find((run) => run.id === chosen) ?? runs.at(-1);
  const measured = runs.filter((run) => run.counts.reports > 0);
  const uncategorized = measured.filter((run) => !hasCategories(run)).length;
  const empty = (
    <EmptyState
      title={refreshing ? "Collecting release results" : "No release results yet"}
      description="Refresh to read release verification results from GitHub."
    />
  );
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
          {!runs.length ? (
            empty
          ) : (
            <Stack gap="lg">
              {measured.length ? (
                <Stack gap="lg">
                  <Stack gap="2xs">
                    <TotalTestsPlot runs={measured} onChoose={setChosen} />
                    {uncategorized ? (
                      <Text textStyle="label/XS" color="fg.muted">
                        {uncategorized === 1
                          ? "1 run shows only its total in gray because its category split has not refreshed yet."
                          : `${uncategorized} runs show only their totals in gray because their category splits have not refreshed yet.`}
                      </Text>
                    ) : null}
                  </Stack>
                  <HealthPlot
                    runs={measured}
                    title="Failed tests"
                    fill="fg.error"
                    value={(run) => run.counts.failed}
                    ariaLabel="Failed tests by release run, oldest first"
                    onChoose={setChosen}
                  />
                  <HealthPlot
                    runs={measured}
                    title="Quarantined tests"
                    fill="fg.warning"
                    value={quarantinedTests}
                    ariaLabel="Quarantined tests by release run, oldest first"
                    onChoose={setChosen}
                  />
                  {measured.some((run) => run.runDurationSeconds !== undefined) ? (
                    <DurationPlot runs={measured} onChoose={setChosen} />
                  ) : null}
                </Stack>
              ) : null}
              <Text textStyle="label/S/regular" color="fg.muted">
                Counts include quarantined cases. Missing reports and unfinished jobs are listed in Runs.
              </Text>
            </Stack>
          )}
        </Tabs.Content>
        <Tabs.Content value="runs">
          {!runs.length ? (
            empty
          ) : (
            <Stack gap="lg">
              <Box h="32rem" minW="0" overflow="hidden">
                <RunsTable runs={runs} selected={selected} onChoose={setChosen} onOpen={onOpen} />
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

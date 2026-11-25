import { Box, Button, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState } from "@pstdio/ui";
import { DataTable, type RowData } from "@pstdio/ui/data-table";
import { Github } from "lucide-react";
import { CategoryBreakdown, formatDuration } from "./health-charts";
import type { ReleaseHealth } from "./types";

export const runVerification = (run: ReleaseHealth) =>
  run.status === "completed" ? (run.conclusion ?? "—") : run.status.replaceAll("_", " ");

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
    verification: runVerification(run),
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

interface HealthRunsProps {
  runs: ReleaseHealth[];
  chosen?: number;
  onChoose: (id: number) => void;
  onOpen: (url: string) => void;
}

export function HealthRuns(props: HealthRunsProps) {
  const { runs, chosen, onChoose, onOpen } = props;
  const selected = runs.find((run) => run.id === chosen) ?? runs.at(-1);
  return (
    <Stack gap="md">
      {selected ? (
        <>
          <Box h="32rem" minW="0" overflow="hidden">
            <RunsTable runs={runs} selected={selected} onChoose={onChoose} onOpen={onOpen} />
          </Box>
          <RunDetail run={selected} onOpen={onOpen} />
        </>
      ) : (
        <EmptyState title="No release runs in this range" />
      )}
    </Stack>
  );
}

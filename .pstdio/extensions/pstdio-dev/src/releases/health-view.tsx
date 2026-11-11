import { Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState, psTheme } from "@pstdio/ui";
import { barY, defineChart, stack } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useState } from "react";
import { PageFrame } from "../webview/page-frame";
import type { HealthHistory } from "./types";

export interface HealthViewProps extends HealthHistory {
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (url: string) => void;
}
const color = (value: string) => psTheme.token.var(`colors.${value}`);

const HealthChart = (props: { runs: HealthHistory["runs"]; onChoose: (id: number) => void }) => {
  const { runs, onChoose } = props;
  const bars = runs.flatMap((entry) => [
    { run: String(entry.id), entry, outcome: "Passed", count: entry.counts.passed },
    { run: String(entry.id), entry, outcome: "Failed", count: entry.counts.failed },
  ]);
  const definition = defineChart({
    marks: [
      barY(bars, {
        x: "run",
        y: "count",
        z: "outcome",
        layout: stack(),
        maxThickness: 64,
        fill: (item) => color(item.outcome === "Passed" ? "fg.success" : "fg.error"),
        stroke: (item) => color(item.entry.counts.failed ? "fg.error" : "transparent"),
        strokeWidth: 1,
      }),
    ],
    scales: {
      x: {
        scale: () =>
          scaleBand<string>()
            .domain(runs.map((run) => String(run.id)))
            .padding(0.2),
        axis: {
          ticks: {
            format: (id: string) =>
              new Date(runs.find((run) => String(run.id) === id)!.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
        },
      },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    focus: "group-x",
    tooltip: {
      use: tooltip,
      anchor: "group-center",
      content: (points) => {
        const run = points[0]!.datum.entry;
        return {
          title: `${new Date(run.createdAt).toLocaleString()} · ${run.sha.slice(0, 7)}`,
          rows: [
            { label: "Passed", value: run.counts.passed.toLocaleString(), color: color("fg.success") },
            { label: "Failed", value: run.counts.failed.toLocaleString(), color: color("fg.error") },
            { label: "Skipped / unrun", value: run.counts.skipped.toLocaleString() },
            { label: "Verification", value: run.conclusion ?? run.status },
            { label: "Publication", value: run.published ? "Published" : "Unpublished" },
            { label: "Reported test jobs", value: `${run.reportedJobs}/${run.testJobs}` },
          ],
        };
      },
    },
  });
  return (
    <Box color="fg.muted" textStyle="label/XS">
      <Chart
        definition={definition}
        height={280}
        ariaLabel="Stacked passed and failed tests by release run, oldest first; red outlines mark runs with failures"
        onFocusChange={(focused) => {
          if (focused) onChoose(Number(focused.datum.run));
        }}
      />
    </Box>
  );
};

export const HealthView = (props: HealthViewProps) => {
  const { runs, syncedAt, error, refreshing, onRefresh, onOpen } = props;
  const [chosen, setChosen] = useState<number>();
  const selected = runs.find((run) => run.id === chosen) ?? runs.at(-1);
  const measured = runs.filter((run) => run.counts.reports > 0);
  return (
    <PageFrame
      toolbar={
        <>
          <HStack gap="md" flex="1" textStyle="label/S/regular">
            <Text color="fg.success">Passed tests</Text>
            <Text color="fg.error">Failed tests</Text>
            {syncedAt ? <Text color="fg.muted">Updated {new Date(syncedAt).toLocaleString()}</Text> : null}
          </HStack>
          <Button size="xs" variant="ghost" loading={refreshing} onClick={onRefresh}>
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
      {!runs.length ? (
        <EmptyState
          title={refreshing ? "Collecting release results" : "No release results yet"}
          description="Refresh to read release verification results from GitHub."
        />
      ) : (
        <>
          {measured.length ? <HealthChart runs={measured} onChoose={setChosen} /> : null}
          <Text textStyle="label/S/regular" color="fg.muted">
            Counts include quarantined cases. Missing reports and unfinished jobs are shown below.
          </Text>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Run</Table.ColumnHeader>
                <Table.ColumnHeader>Verification</Table.ColumnHeader>
                <Table.ColumnHeader>Passed</Table.ColumnHeader>
                <Table.ColumnHeader>Failed</Table.ColumnHeader>
                <Table.ColumnHeader>Evidence</Table.ColumnHeader>
                <Table.ColumnHeader>Publication</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {[...runs].reverse().map((run) => (
                <Table.Row key={run.id}>
                  <Table.Cell>
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-pressed={selected?.id === run.id}
                      onClick={() => setChosen(run.id)}
                    >
                      {new Date(run.createdAt).toLocaleString()} · {run.sha.slice(0, 7)}
                    </Button>
                  </Table.Cell>
                  <Table.Cell>
                    {run.status === "completed" ? run.conclusion : run.status.replaceAll("_", " ")}
                  </Table.Cell>
                  <Table.Cell>{run.counts.reports ? run.counts.passed.toLocaleString() : "—"}</Table.Cell>
                  <Table.Cell color={run.counts.failed ? "fg.error" : undefined}>
                    {run.counts.reports ? run.counts.failed.toLocaleString() : "—"}
                  </Table.Cell>
                  <Table.Cell>
                    {run.reportedJobs}/{run.testJobs} test jobs{run.pendingJobs ? ` · ${run.pendingJobs} pending` : ""}
                  </Table.Cell>
                  <Table.Cell>{run.published ? "Published" : "Unpublished"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {selected ? (
            <Stack gap="sm">
              <HStack>
                <Text textStyle="label/M/medium">
                  Run {selected.id}, attempt {selected.attempt}
                </Text>
                <Button size="xs" variant="ghost" onClick={() => onOpen(selected.url)}>
                  Open on GitHub
                </Button>
              </HStack>
              {selected.failedJobs.map((job) => (
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
              {selected.errors.length ? (
                <AlertMessage status="warning" title="Some test evidence is unavailable">
                  {selected.errors.join("\n")}
                </AlertMessage>
              ) : null}
              <Text textStyle="label/S/regular" color="fg.muted">
                {selected.counts.skipped.toLocaleString()} skipped or unrun tests.{" "}
                {selected.testJobs - selected.reportedJobs - selected.pendingJobs} finished test jobs without summaries.
              </Text>
            </Stack>
          ) : null}
        </>
      )}
    </PageFrame>
  );
};

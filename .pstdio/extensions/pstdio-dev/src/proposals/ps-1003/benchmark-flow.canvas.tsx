import { Box, Flex, Stack, Tabs } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { DEFAULT_PLATFORM } from "../../benchmarks/platforms";
import type { ResultFilter } from "../../compare/compare-view";
import { type TrendsMode, TrendsView } from "../../trends/trends-view";
import { PageFrame } from "../../webview/page-frame";
import { storyCommits, storyTrends } from "../../webview/story-fixtures";
import { CompareView } from "./compare-view";
import {
  BASE,
  cancelledComparison,
  HEAD,
  headOnlyComparison,
  type ProposedRun,
  pairedComparison,
  proposedRuns,
  separateComparison,
} from "./fixtures";
import { ReleasePending, SyncFailed } from "./result-notices";
import { RunForm, type RunRequest } from "./run-form";
import { RunList } from "./run-list";

type Page = "trends" | "compare" | "runs";
type Scenario = "paired" | "cancelled" | "one-commit" | "separate" | "missing" | "sync-failed";

const SCENARIOS: Record<Scenario, Pick<Parameters<typeof CompareView>[0], "base" | "head" | "rows" | "origin">> = {
  paired: { base: BASE, head: HEAD, rows: pairedComparison.rows, origin: { base: "1044", head: "1044" } },
  cancelled: { base: BASE, head: HEAD, rows: cancelledComparison.rows, origin: { base: "1039", head: "1039" } },
  "one-commit": { head: HEAD, rows: headOnlyComparison.rows, origin: { head: "1041" } },
  separate: { base: BASE, head: HEAD, rows: separateComparison.rows, origin: { base: "1031", head: "1041" } },
  missing: { base: BASE, head: "f5c5c4b6e0", rows: [] },
  "sync-failed": { base: BASE, head: HEAD, rows: pairedComparison.rows, origin: { base: "1044", head: "1044" } },
};

// View results opens Compare on the run's own results.
const scenarioOf = (run: ProposedRun): Scenario => {
  if (run.results === "partial") return "cancelled";
  return run.commits.length > 1 ? "paired" : "one-commit";
};

interface BenchmarkFlowProps {
  page: Page;
  scenario: Scenario;
}

const BenchmarkFlow = (props: BenchmarkFlowProps) => {
  const [page, setPage] = useState<Page>(props.page);
  const [scenario, setScenario] = useState<Scenario>(props.scenario);
  const [request, setRequest] = useState<RunRequest>({
    commits: ["pstdio@0.45.0", "main"],
    suites: ["storage", "runtime"],
    platforms: [DEFAULT_PLATFORM],
  });
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [selected, setSelected] = useState<string>();
  const [mode, setMode] = useState<TrendsMode>("versions");
  const [versionIndex, setVersionIndex] = useState(storyTrends.versions.length - 1);
  const [chosenVersions, setChosenVersions] = useState<string[]>();
  const [showTable, setShowTable] = useState(false);
  const shown = SCENARIOS[scenario];
  const runBoth = () => {
    setRequest({ ...request, commits: [shown.base, shown.head].filter((sha): sha is string => Boolean(sha)) });
    setPage("runs");
  };
  return (
    <Flex direction="column" h="100dvh">
      <Tabs.Root
        size="sm"
        variant="line"
        value={page}
        onValueChange={(details) => setPage(details.value as Page)}
        px="lg"
        pt="sm"
      >
        <Tabs.List aria-label="Performance pages">
          <Tabs.Trigger value="trends">Trends</Tabs.Trigger>
          <Tabs.Trigger value="compare">Compare</Tabs.Trigger>
          <Tabs.Trigger value="runs">Runs</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      <Box flex="1" minH="0">
        {page === "trends" ? (
          <Stack h="full" gap="0">
            <Box px="lg" pt="lg">
              <ReleasePending
                version="0.52.0"
                finished={["Linux x64"]}
                running={["macOS arm64", "macOS x64", "Windows x64"]}
              />
            </Box>
            <Box flex="1" minH="0">
              <TrendsView
                versions={storyTrends.versions}
                metrics={storyTrends.metrics}
                platform={DEFAULT_PLATFORM}
                mode={mode}
                versionIndex={versionIndex}
                chosenVersions={chosenVersions}
                showTable={showTable}
                onPlatformChange={() => {}}
                onModeChange={setMode}
                onVersionChange={setVersionIndex}
                onChosenVersionsChange={setChosenVersions}
                onShowTableChange={setShowTable}
              />
            </Box>
          </Stack>
        ) : null}
        {page === "compare" ? (
          <CompareView
            commits={storyCommits}
            base={shown.base}
            head={shown.head}
            platform={DEFAULT_PLATFORM}
            rows={shown.rows}
            origin={shown.origin}
            missingSuites={scenario === "cancelled" ? ["Runtime"] : undefined}
            notice={
              scenario === "sync-failed" ? (
                <SyncFailed lastSynced="today at 09:42" onRetry={() => setScenario("paired")} />
              ) : undefined
            }
            filter={filter}
            selected={selected}
            onBaseChange={() => setScenario("separate")}
            onHeadChange={() => setScenario("missing")}
            onPlatformChange={() => {}}
            onFilterChange={setFilter}
            onSelect={setSelected}
            onRunBoth={runBoth}
          />
        ) : null}
        {page === "runs" ? (
          <PageFrame>
            <Flex gap="lg" wrap="wrap" align="flex-start">
              <Stack flex="1 1 24rem" maxW="lg">
                <RunForm
                  value={request}
                  quick={[
                    { label: "Latest release", ref: "pstdio@0.45.0" },
                    { label: "Previous release", ref: "pstdio@0.44.0" },
                    { label: "main", ref: "main" },
                  ]}
                  pending={false}
                  onChange={setRequest}
                  onStart={() => {}}
                />
              </Stack>
              <Stack flex="999 1 32rem" minW="0">
                <RunList
                  runs={proposedRuns}
                  onCancel={() => {}}
                  onOpen={() => {}}
                  onViewResults={(run) => {
                    setScenario(scenarioOf(run));
                    setPage("compare");
                  }}
                />
              </Stack>
            </Flex>
          </PageFrame>
        ) : null}
      </Box>
    </Flex>
  );
};

const meta: CanvasMeta<typeof BenchmarkFlow> = {
  title: "Proposals/PS-1003 Benchmark flow",
  component: BenchmarkFlow,
  fullscreen: true,
  args: { page: "runs", scenario: "paired" },
};
export default meta;
type Story = CanvasFrame<typeof BenchmarkFlow>;
export const Runs: Story = {
  id: "proposals-ps-1003-benchmark-flow--runs",
};
export const RunResults: Story = {
  id: "proposals-ps-1003-benchmark-flow--run-results",
  args: { page: "compare", scenario: "paired" },
};
export const CancelledRun: Story = {
  id: "proposals-ps-1003-benchmark-flow--cancelled-run",
  args: { page: "compare", scenario: "cancelled" },
};
export const OneCommit: Story = {
  id: "proposals-ps-1003-benchmark-flow--one-commit",
  args: { page: "compare", scenario: "one-commit" },
};
export const SeparateRuns: Story = {
  id: "proposals-ps-1003-benchmark-flow--separate-runs",
  args: { page: "compare", scenario: "separate" },
};
export const MissingComparison: Story = {
  id: "proposals-ps-1003-benchmark-flow--missing-comparison",
  args: { page: "compare", scenario: "missing" },
};
export const SyncFailedResults: Story = {
  id: "proposals-ps-1003-benchmark-flow--sync-failed",
  args: { page: "compare", scenario: "sync-failed" },
};
export const ReleasePendingTrends: Story = {
  id: "proposals-ps-1003-benchmark-flow--release-pending",
  args: { page: "trends", scenario: "paired" },
};

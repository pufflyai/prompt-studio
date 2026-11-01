import { Box, Flex, Stack, Tabs } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { DEFAULT_PLATFORM, PLATFORMS } from "../../benchmarks/platforms";
import { PageFrame } from "../../webview/page-frame";
import { storyCommits, storyTrends } from "../../webview/story-fixtures";
import { CompareView, type ResultFilter } from "./compare-view";
import {
  BASE,
  HEAD,
  headOnlyComparison,
  KNOWN_REFS,
  pairedComparison,
  partialComparison,
  platformTrends,
  proposedRuns,
} from "./fixtures";
import { ReleasePending, SyncFailed } from "./result-notices";
import { RunForm, type RunRequest } from "./run-form";
import { RunList } from "./run-list";
import { TrendsView } from "./trends-view";

type Page = "trends" | "compare" | "runs";
type Scenario = "paired" | "one-commit" | "partial" | "missing" | "sync-failed";

const SCENARIOS: Record<Scenario, Pick<Parameters<typeof CompareView>[0], "base" | "head" | "rows">> = {
  paired: { base: BASE, head: HEAD, rows: pairedComparison.rows },
  "one-commit": { head: HEAD, rows: headOnlyComparison.rows },
  partial: { base: BASE, head: HEAD, rows: partialComparison.rows },
  missing: { base: BASE, head: "f5c5c4b6e0", rows: [] },
  "sync-failed": { base: BASE, head: HEAD, rows: pairedComparison.rows },
};

interface BenchmarkFlowProps {
  page: Page;
  scenario: Scenario;
}

const BenchmarkFlow = (props: BenchmarkFlowProps) => {
  const [page, setPage] = useState<Page>(props.page);
  const [scenario, setScenario] = useState<Scenario>(props.scenario);
  const [request, setRequest] = useState<RunRequest>({
    commits: ["pstdio@0.45.0", "pstdio@0.43.0"],
    suites: ["storage", "runtime"],
    platforms: [DEFAULT_PLATFORM],
  });
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [selected, setSelected] = useState<string>();
  const [platforms, setPlatforms] = useState<string[]>(PLATFORMS.map((platform) => platform.id));
  const [chosenVersions, setChosenVersions] = useState<string[]>();
  const [showTable, setShowTable] = useState(false);
  const shown = SCENARIOS[scenario];
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
          <TrendsView
            versions={storyTrends.versions}
            trends={platformTrends}
            platforms={platforms}
            chosenVersions={chosenVersions}
            showTable={showTable}
            notice={
              <ReleasePending
                version="0.52.0"
                finished={["Linux x64"]}
                running={["macOS arm64", "macOS x64", "Windows x64"]}
              />
            }
            onPlatformsChange={setPlatforms}
            onChosenVersionsChange={setChosenVersions}
            onShowTableChange={setShowTable}
          />
        ) : null}
        {page === "compare" ? (
          <CompareView
            commits={storyCommits}
            base={shown.base}
            head={shown.head}
            platform={DEFAULT_PLATFORM}
            rows={shown.rows}
            notice={
              scenario === "sync-failed" ? (
                <SyncFailed lastSynced="today at 09:42" onRetry={() => setScenario("paired")} />
              ) : undefined
            }
            filter={filter}
            selected={selected}
            onBaseChange={() => setScenario("partial")}
            onHeadChange={() => setScenario("missing")}
            onPlatformChange={() => {}}
            onFilterChange={setFilter}
            onSelect={setSelected}
            onMeasure={(shas) => {
              setRequest({ ...request, commits: shas });
              setPage("runs");
            }}
          />
        ) : null}
        {page === "runs" ? (
          <PageFrame>
            <Flex gap="lg" wrap="wrap" align="flex-start">
              <Stack flex="1 1 24rem" maxW="lg">
                <RunForm value={request} refs={KNOWN_REFS} pending={false} onChange={setRequest} onStart={() => {}} />
              </Stack>
              <Stack flex="999 1 32rem" minW="0">
                <RunList runs={proposedRuns} onCancel={() => {}} onOpen={() => {}} />
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
export const OneCommit: Story = {
  id: "proposals-ps-1003-benchmark-flow--one-commit",
  args: { page: "compare", scenario: "one-commit" },
};
export const MissingMetrics: Story = {
  id: "proposals-ps-1003-benchmark-flow--missing-metrics",
  args: { page: "compare", scenario: "partial" },
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

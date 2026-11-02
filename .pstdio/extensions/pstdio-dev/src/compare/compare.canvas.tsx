import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import type { CompareRow } from "../benchmarks/analysis";
import { SyncFailed } from "../webview/result-notices";
import { storyCommits, storyComparison } from "../webview/story-fixtures";
import { storyHeadOnly, storyOnceComparison, storyPartialComparison } from "../webview/story-runs";
import { CompareView, type ResultFilter } from "./compare-view";

interface InteractiveCompareProps {
  base?: string;
  head: string;
  rows: CompareRow[];
  syncFailed?: boolean;
}
const InteractiveCompare = (props: InteractiveCompareProps) => {
  const [base, setBase] = useState(props.base);
  const [head, setHead] = useState(props.head);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [selected, setSelected] = useState<string>();
  const [platform, setPlatform] = useState("linux-x64");
  const [syncFailed, setSyncFailed] = useState(props.syncFailed);
  const [measuring, setMeasuring] = useState<string[]>([]);
  const measured = storyCommits.filter((commit) => commit.measured).map((commit) => commit.sha);
  const ready = measured.includes(head) && (!base || measured.includes(base));
  return (
    <Box h="100dvh" w="full" minW="0" overflow="hidden">
      <CompareView
        commits={storyCommits}
        base={base}
        head={head}
        platform={platform}
        rows={ready ? props.rows : []}
        filter={filter}
        selected={selected}
        notice={
          syncFailed ? (
            <SyncFailed
              error="GitHub could not be reached."
              syncedAt="2026-11-01T09:42:00Z"
              retrying={false}
              onRetry={() => setSyncFailed(false)}
            />
          ) : undefined
        }
        measuring={measuring}
        onBaseChange={setBase}
        onBaseClear={() => setBase(undefined)}
        onHeadChange={setHead}
        onPlatformChange={setPlatform}
        onFilterChange={setFilter}
        onSelect={setSelected}
        onMeasure={setMeasuring}
      />
    </Box>
  );
};
const meta: CanvasMeta<typeof InteractiveCompare> = {
  title: "Extensions/Prompt Studio Dev/Compare commits",
  component: InteractiveCompare,
  fullscreen: true,
  args: { base: "3d7f5766b0", head: "65d36f4490", rows: storyOnceComparison.rows },
};
export default meta;
type Story = CanvasFrame<typeof InteractiveCompare>;
export const RunResults: Story = {
  id: "extensions-prompt-studio-dev-compare-commits--run-results",
  description: "CI measures each benchmark once, so changes show without an interval or verdict.",
};
export const OneCommit: Story = {
  id: "extensions-prompt-studio-dev-compare-commits--one-commit",
  description: "No base chosen: the head's own measurements and budget outcomes.",
  args: { base: undefined, rows: storyHeadOnly.rows },
};
export const MissingMetrics: Story = {
  id: "extensions-prompt-studio-dev-compare-commits--missing-metrics",
  description: "Commits from different runs; the head has not measured Runtime yet.",
  args: { rows: storyPartialComparison.rows },
};
export const SeveralSamples: Story = {
  id: "extensions-prompt-studio-dev-compare-commits--several-samples",
  description: "Older results with several samples keep their intervals and verdicts.",
  args: { rows: storyComparison.rows },
};
export const HeadNotMeasured: Story = {
  id: "extensions-prompt-studio-dev-compare-commits--head-not-measured",
  description: "Measure starts a run for only the commit without results.",
  args: { head: "f5c5c4b6e0" },
};
export const SyncFailedResults: Story = {
  id: "extensions-prompt-studio-dev-compare-commits--sync-failed",
  description: "Cached results stay readable; Retry sync sits in the alert footer.",
  args: { syncFailed: true },
};

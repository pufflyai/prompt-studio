import { Button, HStack } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { CompareRow } from "../benchmarks/analysis";
import { platformLabel } from "../benchmarks/platforms";
import { metricId } from "../trends/trend-summary";
import { shortSha } from "../webview/format";
import { PageFrame } from "../webview/page-frame";
import { PlatformControl } from "../webview/platform-control";
import { type CommitOptionView, CommitPicker } from "./commit-picker";
import { BASE_COLOR, HEAD_COLOR, ResultsTable } from "./results-table";
import { SampleDetail } from "./sample-detail";

export interface CompareViewProps {
  commits: CommitOptionView[];
  base?: string;
  head?: string;
  platform: string;
  rows: CompareRow[];
  selected?: string;
  onBaseChange: (sha: string) => void;
  onBaseClear: () => void;
  onHeadChange: (sha: string) => void;
  onPlatformChange: (platform: string) => void;
  onSelect: (id: string) => void;
  // Shown above the results, such as a failed sync.
  notice?: ReactNode;
  // Starts a run for the chosen commits that have no results yet. Measured commits are never run again.
  onMeasure: (shas: string[]) => void;
  // Commits an open run is already measuring.
  measuring: string[];
}

const ORDER: Record<NonNullable<CompareRow["change"]>["verdict"], number> = {
  regressed: 0,
  improved: 1,
  unchanged: 2,
  inconclusive: 3,
};

// Regressions first, then improvements, each by size, so the rows that need attention lead.
export const sortRows = (rows: CompareRow[]) =>
  [...rows].sort((a, b) => {
    if (!a.change || !b.change) return Number(!a.change) - Number(!b.change);
    return ORDER[a.change.verdict] - ORDER[b.change.verdict] || Math.abs(b.change.change) - Math.abs(a.change.change);
  });

export const CompareView = (props: CompareViewProps) => {
  const { commits, base, head, platform, rows, selected } = props;
  const find = (sha?: string) => commits.find((commit) => commit.sha === sha);
  const missing = [find(base), find(head)].filter((commit) => commit && !commit.measured);
  const waiting = missing.length > 0 && missing.every((commit) => commit && props.measuring.includes(commit.sha));
  const visible = sortRows(rows);
  const detail = rows.find((row) => metricId(row) === selected) ?? visible[0];
  return (
    <PageFrame
      toolbar={
        <>
          <CommitPicker
            label="Base"
            color={BASE_COLOR}
            value={find(base)}
            options={commits}
            onChange={props.onBaseChange}
            onClear={props.onBaseClear}
          />
          <CommitPicker
            label="Head"
            color={HEAD_COLOR}
            value={find(head)}
            options={commits}
            onChange={props.onHeadChange}
          />
          <HStack flex="1" justify="flex-end" minW="0">
            <PlatformControl value={platform} onValueChange={props.onPlatformChange} />
          </HStack>
        </>
      }
    >
      {props.notice}
      {missing.length ? (
        <EmptyState
          title={`${missing.map((commit) => shortSha(commit?.sha ?? "")).join(" and ")} ${missing.length > 1 ? "have" : "has"} no results on ${platformLabel(platform)}`}
          description={
            waiting
              ? "A run is measuring it now. The comparison fills in when the run finishes."
              : "Measure it once and the comparison fills in when the run finishes. Commits that already have results are not run again."
          }
        >
          <Button
            size="sm"
            variant="primary"
            loading={waiting}
            loadingText="Measuring"
            onClick={() => props.onMeasure(missing.map((commit) => commit?.sha ?? ""))}
          >
            Measure {missing.map((commit) => shortSha(commit?.sha ?? "")).join(" and ")}
          </Button>
        </EmptyState>
      ) : (
        <>
          <ResultsTable
            rows={visible}
            baseChosen={Boolean(base)}
            selected={detail ? metricId(detail) : undefined}
            onSelect={props.onSelect}
          />
          {detail && base && head ? <SampleDetail row={detail} base={base} head={head} /> : null}
        </>
      )}
    </PageFrame>
  );
};

import { Button, Flex, Grid, HStack, Text } from "@chakra-ui/react";
import { EmptyState, SimpleCard } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { CompareRow } from "../../benchmarks/analysis";
import { platformLabel } from "../../benchmarks/platforms";
import type { Verdict } from "../../benchmarks/stats";
import type { CommitOptionView } from "../../compare/commit-picker";
import { BASE_COLOR, HEAD_COLOR } from "../../compare/results-table";
import { SampleDetail } from "../../compare/sample-detail";
import { metricId } from "../../trends/trend-summary";
import { shortSha } from "../../webview/format";
import { PageFrame } from "../../webview/page-frame";
import { PlatformControl } from "../../webview/platform-control";
import { CommitPicker } from "./commit-picker";
import { isSingleSample, ResultsTable } from "./results-table";

export type ResultFilter = "all" | Verdict;

export interface CompareViewProps {
  commits: CommitOptionView[];
  base?: string;
  head?: string;
  platform: string;
  rows: CompareRow[];
  filter: ResultFilter;
  selected?: string;
  onBaseChange: (sha: string) => void;
  onHeadChange: (sha: string) => void;
  onPlatformChange: (platform: string) => void;
  onFilterChange: (filter: ResultFilter) => void;
  onSelect: (id: string) => void;
  // Shown above the results, such as a failed sync.
  notice?: ReactNode;
  // Starts a run for the chosen commits that have no results yet. Measured commits are never run again.
  onMeasure: (shas: string[]) => void;
}

const FILTERS: { value: ResultFilter; label: string }[] = [
  { value: "all", label: "All metrics" },
  { value: "regressed", label: "Regressed" },
  { value: "improved", label: "Improved" },
  { value: "unchanged", label: "No significant change" },
];

const ORDER: Record<Verdict, number> = { regressed: 0, improved: 1, unchanged: 2 };

// Regressions first, then improvements, each by size, so the rows that need attention lead.
export const sortRows = (rows: CompareRow[]) =>
  [...rows].sort((a, b) => {
    if (!a.change || !b.change) return Number(!a.change) - Number(!b.change);
    return ORDER[a.change.verdict] - ORDER[b.change.verdict] || Math.abs(b.change.change) - Math.abs(a.change.change);
  });

// With one sample per commit there is no verdict to filter by, so the tiles summarize what was measured.
const SingleSampleTiles = (props: { rows: CompareRow[]; compared?: number }) => {
  const { rows, compared } = props;
  const overBudget = rows.filter((row) => row.budget !== undefined && row.head && row.head.median > row.budget);
  const tiles = [
    { label: compared === undefined ? "Metrics measured" : "Metrics compared", value: compared ?? rows.length },
    { label: "Over budget", value: overBudget.length },
    { label: "Samples per commit", value: 1 },
  ];
  return (
    <Grid templateColumns="repeat(auto-fit, minmax(12rem, 1fr))" gap="md">
      {tiles.map((tile) => (
        <SimpleCard key={tile.label} p="md" display="flex" flexDirection="column" gap="2xs">
          <Text textStyle="label/S/regular" color="fg.muted">
            {tile.label}
          </Text>
          <Text textStyle="heading/XL">{tile.value}</Text>
        </SimpleCard>
      ))}
    </Grid>
  );
};

export const CompareView = (props: CompareViewProps) => {
  const { commits, base, head, platform, rows, filter, selected } = props;
  const find = (sha?: string) => commits.find((commit) => commit.sha === sha);
  const missing = [find(base), find(head)].filter((commit) => commit && !commit.measured);
  const compared = rows.filter((row) => row.change);
  const single = rows.length > 0 && rows.every(isSingleSample);
  const visible = sortRows(rows).filter((row) => single || filter === "all" || row.change?.verdict === filter);
  const detail = rows.find((row) => metricId(row) === selected) ?? visible[0];
  const count = (value: ResultFilter) =>
    value === "all" ? compared.length : compared.filter((row) => row.change?.verdict === value).length;
  return (
    <PageFrame
      toolbar={
        <HStack flex="1" justify="flex-end" minW="0">
          <PlatformControl value={platform} onValueChange={props.onPlatformChange} />
        </HStack>
      }
    >
      <Flex gap="md" wrap="wrap">
        <CommitPicker
          label="Base"
          color={BASE_COLOR}
          value={find(base)}
          options={commits}
          onChange={props.onBaseChange}
        />
        <CommitPicker
          label="Head"
          color={HEAD_COLOR}
          value={find(head)}
          options={commits}
          onChange={props.onHeadChange}
        />
      </Flex>
      {props.notice}
      {missing.length ? (
        <EmptyState
          title={`${missing.map((commit) => shortSha(commit?.sha ?? "")).join(" and ")} ${missing.length > 1 ? "have" : "has"} no results on ${platformLabel(platform)}`}
          description="Measure it once and the comparison fills in when the run finishes. Commits that already have results are not run again."
        >
          <Button
            size="sm"
            variant="primary"
            onClick={() => props.onMeasure(missing.map((commit) => commit?.sha ?? ""))}
          >
            Measure {missing.map((commit) => shortSha(commit?.sha ?? "")).join(" and ")}
          </Button>
        </EmptyState>
      ) : (
        <>
          {single ? <SingleSampleTiles rows={rows} compared={base ? compared.length : undefined} /> : null}
          <Grid
            display={single ? "none" : undefined}
            templateColumns="repeat(auto-fit, minmax(12rem, 1fr))"
            gap="md"
            role="group"
            aria-label="Filter by result"
          >
            {FILTERS.map((option) => (
              <SimpleCard
                key={option.value}
                as="button"
                p="md"
                textAlign="start"
                display="flex"
                flexDirection="column"
                gap="2xs"
                cursor="pointer"
                aria-pressed={filter === option.value}
                borderColor={filter === option.value ? "border.accent" : "border.subtle"}
                _hover={{ bg: "bg.subtle" }}
                onClick={() => props.onFilterChange(option.value)}
              >
                <Text textStyle="label/S/regular" color="fg.muted">
                  {option.label}
                </Text>
                <Text textStyle="heading/XL">{count(option.value)}</Text>
              </SimpleCard>
            ))}
          </Grid>
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

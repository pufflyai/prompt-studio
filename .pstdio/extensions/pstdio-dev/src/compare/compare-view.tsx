import { Flex, Grid, HStack, Text } from "@chakra-ui/react";
import { EmptyState, SimpleCard } from "@pstdio/ui";
import type { CompareRow } from "../benchmarks/analysis";
import { platformLabel } from "../benchmarks/platforms";
import type { Verdict } from "../benchmarks/stats";
import { metricId } from "../trends/trend-summary";
import { shortSha } from "../webview/format";
import { PageFrame } from "../webview/page-frame";
import { PlatformControl } from "../webview/platform-control";
import { type CommitOptionView, CommitPicker } from "./commit-picker";
import { BASE_COLOR, HEAD_COLOR, ResultsTable } from "./results-table";
import { SampleDetail } from "./sample-detail";

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

export const CompareView = (props: CompareViewProps) => {
  const { commits, base, head, platform, rows, filter, selected } = props;
  const find = (sha?: string) => commits.find((commit) => commit.sha === sha);
  const missing = [find(base), find(head)].filter((commit) => commit && !commit.measured);
  const compared = rows.filter((row) => row.change);
  const visible = sortRows(rows).filter((row) => filter === "all" || row.change?.verdict === filter);
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
      {missing.length ? (
        <EmptyState
          title={`${missing.map((commit) => shortSha(commit?.sha ?? "")).join(" and ")} ${missing.length > 1 ? "have" : "has"} no results on ${platformLabel(platform)}`}
          description="Start a run for both commits from Performance › Runs. Results appear here when the run finishes."
        />
      ) : (
        <>
          <Grid
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
          <ResultsTable rows={visible} selected={detail ? metricId(detail) : undefined} onSelect={props.onSelect} />
          {detail && base && head ? <SampleDetail row={detail} base={base} head={head} /> : null}
        </>
      )}
    </PageFrame>
  );
};

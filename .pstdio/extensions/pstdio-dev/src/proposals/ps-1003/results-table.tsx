import { Box, Grid, Stack, Text } from "@chakra-ui/react";
import { SimpleCard } from "@pstdio/ui";
import type { CompareRow } from "../../benchmarks/analysis";
import { BASE_COLOR, HEAD_COLOR } from "../../compare/results-table";
import { metricId } from "../../trends/trend-summary";
import {
  formatChangeRange,
  formatPercent,
  formatRange,
  formatValue,
  verdictArrow,
  verdictColor,
} from "../../webview/format";

// One value per commit has no spread, so it gets neither an interval nor an improved or regressed verdict.
export const isSingleSample = (row: CompareRow) => (row.base?.samples ?? 1) <= 1 && (row.head?.samples ?? 1) <= 1;
const overBudget = (row: CompareRow) => row.budget !== undefined && row.head !== null && row.head.median > row.budget;

const COLUMNS = "minmax(11rem, 13rem) 9rem 9rem 7rem minmax(12rem, 1fr) 9rem";

interface ResultsTableProps {
  rows: CompareRow[];
  baseChosen: boolean;
  selected?: string;
  onSelect: (id: string) => void;
}

// One scale shared by every row's change plot, wide enough for the largest interval.
const changeScale = (rows: CompareRow[]) => {
  // An increase from zero has no finite size; its dot pins to the plot's edge instead.
  const bounds = rows.flatMap((row) => (row.change ? [Math.abs(row.change.low), Math.abs(row.change.high)] : []));
  const largest = Math.max(0.1, ...bounds.filter(Number.isFinite));
  return [0.1, 0.2, 0.3, 0.5, 1].find((limit) => largest <= limit) ?? largest;
};

interface SummaryCellProps {
  row: CompareRow;
  side: "base" | "head";
}

const SummaryCell = (props: SummaryCellProps) => {
  const { row, side } = props;
  const summary = row[side];
  if (!summary)
    return (
      <Text textStyle="label/S/regular" color="fg.muted" textAlign="end">
        —
      </Text>
    );
  return (
    <Stack gap="0" align="flex-end">
      <Text textStyle="label/S/regular">{formatValue(summary.median, row.unit)}</Text>
      <Text textStyle="label/XS" color="fg.muted">
        {summary.samples > 1 ? formatRange(summary.low, summary.high, row.unit) : "1 sample"}
      </Text>
    </Stack>
  );
};

const Bars = (props: { row: CompareRow }) => {
  const { row } = props;
  const top = Math.max(row.base?.high ?? 0, row.head?.high ?? 0, row.budget ?? 0) * 1.1;
  const at = (value: number) => `${(value / top) * 100}%`;
  return (
    <Stack gap="1" aria-hidden="true" position="relative">
      {row.budget === undefined ? null : (
        <Box
          position="absolute"
          insetY="-1"
          left={at(row.budget)}
          borderStartWidth="1px"
          borderStyle="dashed"
          borderColor="fg.muted"
        />
      )}
      {(["base", "head"] as const).map((side) => {
        const summary = row[side];
        return (
          <Box key={side} position="relative" h="2.5">
            {summary ? (
              <>
                <Box
                  h="full"
                  w={at(summary.median)}
                  bg={side === "base" ? BASE_COLOR : HEAD_COLOR}
                  borderEndRadius="xs"
                />
                <Box
                  position="absolute"
                  top="calc(50% - 1px)"
                  h="0.5"
                  left={at(summary.low)}
                  w={at(summary.high - summary.low)}
                  bg="fg"
                />
              </>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
};

const ChangePlot = (props: { row: CompareRow; scale: number }) => {
  const { row, scale } = props;
  const at = (share: number) => `${50 + Math.max(-50, Math.min(50, (share / scale) * 50))}%`;
  const single = isSingleSample(row);
  const color = row.change && !single ? verdictColor[row.change.verdict] : "fg.muted";
  return (
    <Box position="relative" h="6" aria-hidden="true">
      <Box position="absolute" insetY="0" left="50%" borderStartWidth="1px" borderColor="border" />
      {row.change ? (
        <>
          <Box
            display={single ? "none" : undefined}
            position="absolute"
            top="calc(50% - 1px)"
            h="0.5"
            left={at(row.change.low)}
            right={`calc(100% - ${at(row.change.high)})`}
            bg={color}
          />
          <Box
            position="absolute"
            top="50%"
            left={at(row.change.change)}
            boxSize="2.5"
            borderRadius="full"
            bg={color}
            transform="translate(-50%, -50%)"
          />
        </>
      ) : null}
    </Box>
  );
};

const ChangeCell = (props: { row: CompareRow; baseChosen: boolean }) => {
  const { row, baseChosen } = props;
  const once = isSingleSample(row);
  let value = "—";
  let color = "fg.muted";
  let detail = row.head ? "Not measured on base" : "Not measured on head";
  if (!baseChosen) detail = "No base chosen";
  else if (row.change) {
    value = once
      ? formatPercent(row.change.change)
      : `${verdictArrow[row.change.verdict]} ${formatPercent(row.change.change)}`;
    color = once ? "fg" : verdictColor[row.change.verdict];
    detail = once ? "1 sample each · no interval" : formatChangeRange(row.change);
  }
  if (overBudget(row)) detail = `Over the ${formatValue(row.budget ?? 0, row.unit)} budget`;
  return (
    <Stack gap="0" align="flex-end">
      <Text textStyle="label/S/medium" color={color}>
        {value}
      </Text>
      <Text textStyle="label/XS" color={overBudget(row) ? "fg.error" : "fg.muted"}>
        {detail}
      </Text>
    </Stack>
  );
};

export const ResultsTable = (props: ResultsTableProps) => {
  const { rows, baseChosen, selected, onSelect } = props;
  const scale = changeScale(rows);
  const single = rows.every(isSingleSample);
  return (
    <SimpleCard overflowX="auto">
      <Box minW="5xl">
        <Grid templateColumns={COLUMNS} gap="md" px="md" py="sm" textStyle="label/XS" color="fg.muted" alignItems="end">
          <Text>Metric</Text>
          <Text textAlign="end">{single ? "Base" : "Base median · 95% CI"}</Text>
          <Text textAlign="end">{single ? "Head" : "Head median · 95% CI"}</Text>
          <Text>Base and head</Text>
          <Box position="relative" h="4">
            {[-scale, 0, scale].map((tick) => (
              <Text
                key={tick}
                position="absolute"
                left={`${50 + (tick / scale) * 50}%`}
                transform="translateX(-50%)"
                textStyle="mono/XS"
              >
                {tick ? formatPercent(tick).replace(".0", "") : "0"}
              </Text>
            ))}
          </Box>
          <Text textAlign="end">{single ? "Difference" : "Change · 95% CI"}</Text>
        </Grid>
        {rows.map((row) => {
          const id = metricId(row);
          return (
            <Grid
              key={id}
              as="button"
              w="full"
              templateColumns={COLUMNS}
              gap="md"
              px="md"
              py="sm"
              textAlign="start"
              alignItems="center"
              borderTopWidth="1px"
              borderColor="border.subtle"
              bg={id === selected ? "bg.subtle" : undefined}
              _hover={{ bg: "bg.subtle" }}
              aria-pressed={id === selected}
              onClick={() => onSelect(id)}
            >
              <Stack gap="0" minW="0">
                <Text textStyle="label/S/medium" truncate>
                  {row.label}
                </Text>
                <Text textStyle="label/XS" color="fg.muted" truncate>
                  {row.suiteLabel}
                </Text>
              </Stack>
              <SummaryCell row={row} side="base" />
              <SummaryCell row={row} side="head" />
              <Bars row={row} />
              <ChangePlot row={row} scale={scale} />
              <ChangeCell row={row} baseChosen={baseChosen} />
            </Grid>
          );
        })}
      </Box>
      <Text textStyle="label/XS" color="fg.muted" px="md" py="sm" borderTopWidth="1px" borderColor="border.subtle">
        {single
          ? "Each commit was measured once. Bars show each value; a dashed line marks the budget. The dot is the difference between the two values. One sample is not enough evidence for a confidence interval or an improved or regressed verdict."
          : "Bars show each commit's median with its 95% confidence interval; a dashed line marks the budget. The dot is the change in median; its line is the 95% bootstrap interval. Left of zero is faster or smaller. A change counts only when its interval excludes zero."}
      </Text>
    </SimpleCard>
  );
};

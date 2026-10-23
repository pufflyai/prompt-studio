import { Box, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { TrendMetric, TrendPoint } from "../benchmarks/analysis";
import { ChangeChip } from "../webview/change-chip";
import { formatChangeRange, formatRange, formatValue } from "../webview/format";
import { groupBySuite, metricId } from "./trend-summary";

interface VersionSnapshotProps {
  metrics: TrendMetric[];
  index: number;
}

interface MetricRowProps {
  metric: TrendMetric;
  point: TrendPoint;
}

const ROW_COLUMNS = "minmax(12rem, 15rem) 10rem minmax(12rem, 1fr) 12rem";

// Each row has its own scale because units differ; the bar and the budget line compare within a row.
const MetricRow = (props: MetricRowProps) => {
  const { metric, point } = props;
  const top = Math.max(point.high, metric.budget ?? 0) * 1.12;
  const at = (value: number) => `${(value / top) * 100}%`;
  const overBudget = metric.budget !== undefined && point.median >= metric.budget;
  return (
    <Grid
      templateColumns={ROW_COLUMNS}
      gap="lg"
      alignItems="center"
      py="sm"
      borderTopWidth="1px"
      borderColor="border.subtle"
    >
      <Text textStyle="label/S/medium" truncate>
        {metric.label}
      </Text>
      <Stack gap="0" align="flex-end">
        <Text textStyle="label/M/medium">{formatValue(point.median, metric.unit)}</Text>
        <Text textStyle="label/XS" color="fg.muted">
          {formatRange(point.low, point.high, metric.unit)}
        </Text>
        {metric.budget === undefined ? null : (
          <Text textStyle="label/XS" color={overBudget ? "fg.error" : "fg.muted"}>
            {overBudget ? "Over budget" : "Budget"} {formatValue(metric.budget, metric.unit)}
          </Text>
        )}
      </Stack>
      <Box position="relative" h="8" aria-hidden="true">
        <Box position="absolute" insetX="0" top="calc(50% - 1px)" h="0.5" bg="bg.subtle" />
        <Box
          position="absolute"
          left="0"
          top="calc(50% - 6px)"
          h="3"
          w={at(point.median)}
          bg="vis.categorical.1"
          borderEndRadius="xs"
        />
        <Box
          position="absolute"
          top="calc(50% - 1px)"
          h="0.5"
          left={at(point.low)}
          w={at(point.high - point.low)}
          bg="fg"
        />
        {metric.budget === undefined ? null : (
          <Box
            position="absolute"
            insetY="0"
            left={at(metric.budget)}
            borderStartWidth="1px"
            borderStyle="dashed"
            borderColor="fg.muted"
          />
        )}
      </Box>
      <Stack gap="2xs" align="flex-start">
        <ChangeChip change={point.change} unit={metric.unit} emptyLabel="First tracked version" />
        {point.change ? (
          <Text textStyle="label/XS" color="fg.muted">
            {formatChangeRange(point.change)}
          </Text>
        ) : null}
      </Stack>
    </Grid>
  );
};

export const VersionSnapshot = (props: VersionSnapshotProps) => {
  const { metrics, index } = props;
  const shown = metrics.filter((metric) => metric.points[index]);
  const groups = groupBySuite(shown);
  const hasBudget = shown.some((metric) => metric.budget !== undefined);
  return (
    <SimpleCard>
      <SimpleCardBody display="flex" flexDirection="column" gap="lg" overflowX="auto">
        <HStack gap="md" wrap="wrap" textStyle="label/XS" color="fg.muted">
          <HStack gap="2xs">
            <Box w="4" h="2.5" bg="vis.categorical.1" borderEndRadius="2xs" />
            <Text>Median</Text>
          </HStack>
          <HStack gap="2xs">
            <Box w="4" h="0.5" bg="fg" />
            <Text>95% confidence interval</Text>
          </HStack>
          {hasBudget ? (
            <HStack gap="2xs">
              <Box h="3" borderStartWidth="1px" borderStyle="dashed" borderColor="fg.muted" />
              <Text>Budget</Text>
            </HStack>
          ) : null}
        </HStack>
        {groups.map((group) => (
          <Stack key={group.suite} gap="0" minW="3xl">
            <Text textStyle="label/M/medium" pb="xs">
              {group.label}
            </Text>
            {group.metrics.map((metric) => {
              const point = metric.points[index];
              if (!point) return null;
              return <MetricRow key={metricId(metric)} metric={metric} point={point} />;
            })}
          </Stack>
        ))}
      </SimpleCardBody>
    </SimpleCard>
  );
};

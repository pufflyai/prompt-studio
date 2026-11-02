import { HStack, Stack, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { platformLabel } from "../benchmarks/platforms";
import { formatChangeRange, formatRange, formatValue, verdictText } from "../webview/format";
import { type FocusedPoint, type PlatformSeries, TrendChart } from "./trend-chart";

interface TrendCardProps {
  series: PlatformSeries[];
  versions: string[];
}

// One sample has no spread, so it shows no interval and its change no range.
const changeText = (point: FocusedPoint, series: PlatformSeries) => {
  if (!point.change) return "first result";
  const text = verdictText(point.change, series.metric.unit);
  return point.change.verdict === "inconclusive" ? text : `${text} (${formatChangeRange(point.change)})`;
};

const pointDetail = (point: FocusedPoint, series: PlatformSeries) =>
  [
    point.version,
    platformLabel(point.platform),
    `median ${formatValue(point.median, series.metric.unit)}`,
    point.samples > 1 ? `95% CI ${formatRange(point.low, point.high, series.metric.unit)}` : "1 sample",
    changeText(point, series),
  ].join(" · ");

// One time series per benchmark: a median line per platform, and the budget when it has one.
export const TrendCard = (props: TrendCardProps) => {
  const { series, versions } = props;
  const [focused, setFocused] = useState<FocusedPoint | null>(null);
  const [first] = series;
  if (!first) return null;
  const { metric } = first;
  return (
    <SimpleCard minW="0">
      <SimpleCardBody display="flex" flexDirection="column" gap="xs">
        <HStack justify="space-between" gap="sm" align="baseline">
          <Text textStyle="label/M/medium" truncate>
            {metric.label}
          </Text>
          {metric.budget === undefined ? null : (
            <Text textStyle="label/XS" color="fg.muted" flexShrink={0}>
              Budget {formatValue(metric.budget, metric.unit)}
            </Text>
          )}
        </HStack>
        <Stack gap="2xs">
          <TrendChart series={series} versions={versions} height={180} onFocusPoint={setFocused} />
          <Text textStyle="label/XS" color="fg.muted" minH="4" aria-live="polite" truncate>
            {focused ? pointDetail(focused, first) : ""}
          </Text>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

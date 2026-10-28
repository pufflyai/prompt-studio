import { HStack, Stack, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import type { TrendMetric, TrendPoint } from "../benchmarks/analysis";
import { formatChangeRange, formatRange, formatValue, verdictText } from "../webview/format";
import { TrendChart } from "./trend-chart";

interface TrendCardProps {
  metric: TrendMetric;
  versions: string[];
}

const pointDetail = (point: TrendPoint, metric: TrendMetric) =>
  [
    point.version,
    `median ${formatValue(point.median, metric.unit)}`,
    `95% CI ${formatRange(point.low, point.high, metric.unit)}`,
    point.change ? `${verdictText(point.change, metric.unit)} (${formatChangeRange(point.change)})` : "first result",
  ].join(" · ");

// One time series per benchmark: median line, 95% interval band, and the budget when it has one.
export const TrendCard = (props: TrendCardProps) => {
  const { metric, versions } = props;
  const [focused, setFocused] = useState<TrendPoint | null>(null);
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
          <TrendChart metric={metric} versions={versions} height={180} onFocusPoint={setFocused} />
          <Text textStyle="label/XS" color="fg.muted" minH="4" aria-live="polite" truncate>
            {focused ? pointDetail(focused, metric) : ""}
          </Text>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

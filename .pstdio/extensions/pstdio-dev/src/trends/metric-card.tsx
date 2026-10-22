import { Box, HStack, Text } from "@chakra-ui/react";
import { SimpleCard } from "@pstdio/ui";
import type { TrendMetric } from "../benchmarks/analysis";
import { ChangeChip } from "../webview/change-chip";
import { formatValue } from "../webview/format";
import { TrendChart } from "./trend-chart";

interface MetricCardProps {
  metric: TrendMetric;
  versions: string[];
  selected: boolean;
  onSelect: () => void;
}

export const MetricCard = (props: MetricCardProps) => {
  const { metric, versions, selected, onSelect } = props;
  const latest = metric.points.at(-1);
  return (
    <SimpleCard
      as="button"
      onClick={onSelect}
      aria-pressed={selected}
      textAlign="start"
      display="flex"
      flexDirection="column"
      gap="xs"
      p="md"
      minW="0"
      borderColor={selected ? "border.accent" : "border.subtle"}
      cursor="pointer"
      _hover={{ bg: "bg.subtle" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "border.accent" }}
    >
      <HStack justify="space-between" gap="xs" w="full">
        <Text textStyle="label/S/medium" truncate>
          {metric.label}
        </Text>
        {latest ? <ChangeChip change={latest.change} unit={metric.unit} /> : null}
      </HStack>
      <Text textStyle="heading/M">{latest ? formatValue(latest.median, metric.unit) : "Not measured"}</Text>
      <Box w="full" pointerEvents="none">
        <TrendChart metric={metric} versions={versions} height={48} compact />
      </Box>
      <HStack justify="space-between" w="full" textStyle="label/XS" color="fg.muted">
        <Text>{versions[0]}</Text>
        <Text>{metric.budget === undefined ? "No budget" : `Budget ${formatValue(metric.budget, metric.unit)}`}</Text>
        <Text>{versions.at(-1)}</Text>
      </HStack>
    </SimpleCard>
  );
};

import { Box, Button, Flex, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import type { TrendMetric, TrendPoint } from "../benchmarks/analysis";
import { ChangeChip } from "../webview/change-chip";
import { formatChangeRange, formatRange, formatValue, verdictText } from "../webview/format";
import { TrendChart } from "./trend-chart";

interface SelectedMetricProps {
  metric: TrendMetric;
  versions: string[];
}

interface LegendSwatchProps {
  label: string;
  swatch: "line" | "band" | "budget";
}

const LegendSwatch = (props: LegendSwatchProps) => {
  const { label, swatch } = props;
  return (
    <HStack gap="2xs">
      {swatch === "line" ? <Box w="4" h="0.5" bg="vis.categorical.1" /> : null}
      {swatch === "band" ? <Box w="4" h="2.5" bg="vis.categorical.1" opacity={0.18} borderRadius="2xs" /> : null}
      {swatch === "budget" ? <Box w="4" borderTopWidth="1px" borderStyle="dashed" borderColor="fg.muted" /> : null}
      <Text>{label}</Text>
    </HStack>
  );
};

const pointDetail = (point: TrendPoint, metric: TrendMetric) =>
  [
    point.version,
    `median ${formatValue(point.median, metric.unit)}`,
    `95% CI ${formatRange(point.low, point.high, metric.unit)}`,
    point.change ? `${verdictText(point.change, metric.unit)} (${formatChangeRange(point.change)})` : "first result",
    `${point.samples} samples`,
  ].join(" · ");

const TrendTable = (props: SelectedMetricProps) => {
  const { metric } = props;
  return (
    <Table.ScrollArea>
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Version</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Median</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">95% CI</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Change</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Samples</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {metric.points.flatMap((point) =>
            point
              ? [
                  <Table.Row key={point.version}>
                    <Table.Cell textStyle="mono/XS">{point.version}</Table.Cell>
                    <Table.Cell textAlign="end">{formatValue(point.median, metric.unit)}</Table.Cell>
                    <Table.Cell textAlign="end">{formatRange(point.low, point.high, metric.unit)}</Table.Cell>
                    <Table.Cell textAlign="end">
                      {point.change
                        ? `${verdictText(point.change, metric.unit)}, ${formatChangeRange(point.change)}`
                        : "—"}
                    </Table.Cell>
                    <Table.Cell textAlign="end">{point.samples}</Table.Cell>
                  </Table.Row>,
                ]
              : [],
          )}
        </Table.Body>
      </Table.Root>
    </Table.ScrollArea>
  );
};

export const SelectedMetric = (props: SelectedMetricProps) => {
  const { metric, versions } = props;
  const [showTable, setShowTable] = useState(false);
  const [focused, setFocused] = useState<TrendPoint | null>(null);
  const latest = metric.points.at(-1);
  return (
    <SimpleCard>
      <SimpleCardBody display="flex" flexDirection="column" gap="md">
        <Flex justify="space-between" gap="md" wrap="wrap" align="flex-start">
          <Stack gap="2xs" minW="0">
            <Text textStyle="label/S/regular" color="fg.muted">
              {metric.suiteLabel}
            </Text>
            <Text textStyle="heading/M">{metric.label}</Text>
          </Stack>
          {latest ? (
            <Stack gap="2xs" align="flex-end">
              <HStack gap="xs" align="baseline">
                <Text textStyle="heading/XL">{formatValue(latest.median, metric.unit)}</Text>
                <Text textStyle="label/S/regular" color="fg.muted">
                  95% CI {formatRange(latest.low, latest.high, metric.unit)}
                </Text>
              </HStack>
              <ChangeChip change={latest.change} unit={metric.unit} />
            </Stack>
          ) : null}
        </Flex>
        <Flex justify="space-between" gap="md" wrap="wrap" align="center" textStyle="label/XS" color="fg.muted">
          <HStack gap="md" wrap="wrap">
            <LegendSwatch swatch="line" label="Median" />
            <LegendSwatch swatch="band" label="95% confidence interval" />
            {metric.budget === undefined ? null : (
              <LegendSwatch swatch="budget" label={`Budget ${formatValue(metric.budget, metric.unit)}`} />
            )}
          </HStack>
          <Button size="xs" variant="outline" onClick={() => setShowTable(!showTable)} aria-pressed={showTable}>
            {showTable ? "Show chart" : "Show table"}
          </Button>
        </Flex>
        {showTable ? (
          <TrendTable metric={metric} versions={versions} />
        ) : (
          <Stack gap="xs">
            <TrendChart metric={metric} versions={versions} height={280} onFocusPoint={setFocused} />
            <Text textStyle="label/S/regular" color="fg.muted" aria-live="polite" minH="5">
              {focused ? pointDetail(focused, metric) : "Hover or focus a release to see its interval and change."}
            </Text>
          </Stack>
        )}
      </SimpleCardBody>
    </SimpleCard>
  );
};

import { Stack, Table, Text } from "@chakra-ui/react";
import { SimpleCard } from "@pstdio/ui";
import type { TrendMetric } from "../benchmarks/analysis";
import { formatRange, formatValue } from "../webview/format";
import { metricId } from "./trend-summary";

interface TrendsTableProps {
  versions: string[];
  metrics: TrendMetric[];
}

// One row per version and one column per benchmark, newest version first.
export const TrendsTable = (props: TrendsTableProps) => {
  const { versions, metrics } = props;
  const rows = versions.map((version, index) => ({ version, index })).reverse();
  return (
    <SimpleCard>
      <Table.ScrollArea>
        <Table.Root size="sm" stickyHeader>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader position="sticky" left="0" bg="bg" zIndex="1">
                Version
              </Table.ColumnHeader>
              {metrics.map((metric) => (
                <Table.ColumnHeader key={metricId(metric)} textAlign="end" minW="10rem">
                  <Stack gap="0" align="flex-end">
                    <Text textStyle="label/S/medium">{metric.label}</Text>
                    <Text textStyle="label/XS" color="fg.muted">
                      {metric.suiteLabel}
                      {metric.budget === undefined ? "" : ` · budget ${formatValue(metric.budget, metric.unit)}`}
                    </Text>
                  </Stack>
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map(({ version, index }) => (
              <Table.Row key={version}>
                <Table.Cell textStyle="mono/XS" position="sticky" left="0" bg="bg" zIndex="1">
                  {version}
                </Table.Cell>
                {metrics.map((metric) => {
                  const point = metric.points[index];
                  return (
                    <Table.Cell key={metricId(metric)} textAlign="end">
                      {point ? (
                        <Stack gap="0" align="flex-end">
                          <Text textStyle="label/S/regular">{formatValue(point.median, metric.unit)}</Text>
                          <Text textStyle="label/XS" color="fg.muted">
                            {formatRange(point.low, point.high, metric.unit)}
                          </Text>
                        </Stack>
                      ) : (
                        <Text color="fg.muted">—</Text>
                      )}
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
    </SimpleCard>
  );
};

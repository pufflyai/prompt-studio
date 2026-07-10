import { Chart, useChart } from "@chakra-ui/charts";
import { Box, Flex, Table, Text } from "@chakra-ui/react";
import type { Header, HeaderGroup } from "@tanstack/react-table";
import { Bar, BarChart } from "recharts";
import { buildHistogramStat, buildTopValuesStat, countUniqueStatValues } from "./data-table-stats";
import type { DataTableColumnStat, RowData } from "./types";

const formatNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format;

interface UniqueStatProps {
  rows: RowData[];
  columnId: string;
}

const UniqueStat = (props: UniqueStatProps) => {
  const { rows, columnId } = props;
  const count = countUniqueStatValues(rows, columnId);

  return (
    <Flex direction="column" gap="2xs" alignItems="flex-start">
      <Text textStyle="label/L/medium" lineHeight="1">
        {formatNumber(count)}
      </Text>
      <Text textStyle="label/XS/regular" color="fg.muted">
        unique values
      </Text>
    </Flex>
  );
};

interface HistogramStatProps {
  rows: RowData[];
  columnId: string;
  binCount: number;
}

const HistogramStat = (props: HistogramStatProps) => {
  const { rows, columnId, binCount } = props;
  const histogram = buildHistogramStat(rows, columnId, binCount);
  const chart = useChart({
    data: histogram?.bins ?? [],
    series: [{ name: "count", color: "blue.solid" }],
  });

  if (!histogram) {
    return (
      <Text textStyle="label/XS/regular" color="fg.muted">
        No numeric values
      </Text>
    );
  }

  return (
    <Flex direction="column" width="100%" gap="2xs">
      <Chart.Root chart={chart} height="40px" aspectRatio="auto" aria-label={`Distribution for ${columnId}`}>
        <BarChart responsive data={chart.data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap={1}>
          <Bar dataKey={chart.key("count")} fill={chart.color("blue.solid")} isAnimationActive={false} />
        </BarChart>
      </Chart.Root>
      <Flex justifyContent="space-between" gap="xs">
        <Text textStyle="label/XS/regular" color="fg.muted">
          {formatNumber(histogram.min)}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted">
          {formatNumber(histogram.max)}
        </Text>
      </Flex>
    </Flex>
  );
};

interface TopValuesStatProps {
  rows: RowData[];
  columnId: string;
  limit: number;
}

const TopValuesStat = (props: TopValuesStatProps) => {
  const { rows, columnId, limit } = props;
  const groups = buildTopValuesStat(rows, columnId, limit);

  return (
    <Flex direction="column" width="100%" gap="2xs">
      {groups.map((group) => (
        <Box key={group.label} position="relative" overflow="hidden" paddingX="2xs">
          <Box position="absolute" insetY="0" insetStart="0" width={`${group.percentage}%`} background="blue.subtle" />
          <Flex position="relative" justifyContent="space-between" gap="xs">
            <Text textStyle="label/XS/regular" truncate>
              {group.label}
            </Text>
            <Text textStyle="label/XS/medium" color="fg.muted">
              {group.percentage}%
            </Text>
          </Flex>
        </Box>
      ))}
    </Flex>
  );
};

interface DataTableStatProps {
  rows: RowData[];
  columnId: string;
  stat: DataTableColumnStat;
}

const DataTableStat = (props: DataTableStatProps) => {
  const { rows, columnId, stat } = props;

  if (stat.type === "unique") return <UniqueStat rows={rows} columnId={columnId} />;
  if (stat.type === "histogram") {
    return <HistogramStat rows={rows} columnId={columnId} binCount={stat.bins ?? 10} />;
  }
  return <TopValuesStat rows={rows} columnId={columnId} limit={stat.limit ?? 2} />;
};

interface DataTableStatCellProps {
  header: Header<RowData, unknown>;
  headerGroup: HeaderGroup<RowData>;
  rows: RowData[];
  columnStats: Partial<Record<string, DataTableColumnStat>>;
  fullWidth?: boolean;
}

const DataTableStatCell = (props: DataTableStatCellProps) => {
  const { header, headerGroup, rows, columnStats, fullWidth } = props;
  const stat = columnStats[header.column.id];

  return (
    <Table.ColumnHeader
      data-column-id={header.column.id}
      data-stat-type={stat?.type}
      borderRight="1px solid"
      _last={{ borderRight: "none" }}
      borderColor="border.subtle"
      padding="xs"
      verticalAlign="middle"
      overflow="hidden"
      style={{
        width:
          fullWidth && headerGroup.headers.indexOf(header) === headerGroup.headers.length - 1
            ? undefined
            : `calc(var(--header-${header.id}-size) * 1px)`,
      }}
    >
      {stat ? <DataTableStat rows={rows} columnId={header.column.id} stat={stat} /> : null}
    </Table.ColumnHeader>
  );
};

interface DataTableStatsRowProps {
  headerGroup: HeaderGroup<RowData>;
  rows: RowData[];
  columnStats: Partial<Record<string, DataTableColumnStat>>;
  fullWidth?: boolean;
  noBorder?: boolean;
}

export const DataTableStatsRow = (props: DataTableStatsRowProps) => {
  const { headerGroup, rows, columnStats, fullWidth, noBorder } = props;
  const hasVisibleStats = headerGroup.headers.some((header) => columnStats[header.column.id]);

  if (!hasVisibleStats) return null;

  return (
    <Table.Row
      className="data-table-stats-row"
      borderRight={noBorder ? "none" : "1px solid"}
      borderColor="border.subtle"
    >
      {headerGroup.headers.map((header) => (
        <DataTableStatCell
          key={header.id}
          header={header}
          headerGroup={headerGroup}
          rows={rows}
          columnStats={columnStats}
          fullWidth={fullWidth}
        />
      ))}
    </Table.Row>
  );
};

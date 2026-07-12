import { Chart, type UseChartProps, useChart } from "@chakra-ui/charts";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Tooltip as RechartsTooltip,
  useActiveTooltipCoordinate,
  usePlotArea,
  XAxis,
  YAxis,
} from "recharts";

type ChartSeries<T> = NonNullable<UseChartProps<T>["series"]>[number];
type StringKeyOf<T> = Extract<keyof T, string>;

const StatChartCrosshair = () => {
  const coordinate = useActiveTooltipCoordinate();
  const plotArea = usePlotArea();

  if (!coordinate || !plotArea) return null;

  return (
    <g pointerEvents="none" stroke="var(--chakra-colors-border-emphasized)" strokeWidth="1">
      <line x1={coordinate.x} x2={coordinate.x} y1={plotArea.y} y2={plotArea.y + plotArea.height} />
      <line x1={plotArea.x} x2={plotArea.x + plotArea.width} y1={coordinate.y} y2={coordinate.y} />
    </g>
  );
};

interface DataTableStatChartProps<T extends object> {
  data: T[];
  dataKey: StringKeyOf<T>;
  color: ChartSeries<T>["color"];
  height: string;
  ariaLabel: string;
  tooltipLabel: (datum: T) => ReactNode;
  tooltipValue: (value: string | number) => ReactNode;
  tooltipSeriesLabel: string;
  layout?: "horizontal" | "vertical";
  categoryKey?: StringKeyOf<T>;
  domain?: [number, number];
  barSize?: number;
  barCategoryGap?: number;
}

export const DataTableStatChart = <T extends object>(props: DataTableStatChartProps<T>) => {
  const {
    data,
    dataKey,
    color,
    height,
    ariaLabel,
    tooltipLabel,
    tooltipValue,
    tooltipSeriesLabel,
    layout = "horizontal",
    categoryKey,
    domain,
    barSize,
    barCategoryGap = 1,
  } = props;
  const chart = useChart({ data, series: [{ name: dataKey, color }] });
  const getBarValue = (datum: T) => datum[dataKey] as string | number;
  const getCategoryValue = categoryKey ? (datum: T) => datum[categoryKey] as string | number : undefined;

  return (
    <Chart.Root chart={chart} height={height} aspectRatio="auto" cursor="crosshair" aria-label={ariaLabel}>
      <BarChart
        responsive
        data={chart.data}
        layout={layout}
        margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        barCategoryGap={barCategoryGap}
      >
        {layout === "vertical" ? (
          <>
            <XAxis type="number" domain={domain} hide />
            <YAxis type="category" dataKey={getCategoryValue} hide />
          </>
        ) : null}
        <Bar dataKey={getBarValue} fill={chart.color(color)} barSize={barSize} isAnimationActive={false} />
        <RechartsTooltip
          allowEscapeViewBox={{ x: true, y: true }}
          content={
            <Chart.Tooltip
              labelFormatter={(label, payload) => {
                const datum = payload[0]?.payload as T | undefined;
                return datum ? tooltipLabel(datum) : label;
              }}
              formatter={(value) => [tooltipValue(value), tooltipSeriesLabel]}
            />
          }
          cursor={<StatChartCrosshair />}
          isAnimationActive={false}
          wrapperStyle={{ zIndex: 1800 }}
        />
      </BarChart>
    </Chart.Root>
  );
};

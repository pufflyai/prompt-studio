import { Stack, Text } from "@chakra-ui/react";
import { barX, barY, defineChart } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { ReactNode } from "react";
import { Chart, chartColor } from "@/components/charts/chart";
import { chartGeometry } from "@/theme/primitives/chart";

type StringKeyOf<T> = Extract<keyof T, string>;

export interface DataTableStatChartProps<T extends object> {
  data: T[];
  dataKey: StringKeyOf<T>;
  color: string;
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
    domain,
    barSize,
    barCategoryGap = 1,
  } = props;
  const points = data.map((datum, index) => ({ id: String(index), datum, value: Number(datum[dataKey]) }));
  const fill = chartColor(color);
  const chartProps = {
    ariaLabel,
    height,
    renderTooltipBody: ({ primaryPoint }: { primaryPoint?: { datum: (typeof points)[number] } }) =>
      primaryPoint ? (
        <Stack gap="2xs">
          <Text textStyle="label/XS/medium">{tooltipLabel(primaryPoint.datum.datum)}</Text>
          <Text textStyle="label/XS/regular">
            {tooltipSeriesLabel}: {tooltipValue(primaryPoint.datum.value)}
          </Text>
        </Stack>
      ) : null,
  };
  if (layout === "vertical")
    return (
      <Chart
        {...chartProps}
        definition={defineChart(
          {
            marks: [
              barX(points, { radius: chartGeometry.barRadius, x: "value", y: "id", fill, maxThickness: barSize }),
            ],
            guides: false,
            margin: 0,
            scales: {
              x: { scale: scaleLinear().domain(domain ?? [0, Math.max(1, ...points.map(({ value }) => value))]) },
              y: { scale: () => scaleBand<string>().padding(0) },
            },
          },
          { tooltip: { use: tooltip } },
        )}
      />
    );
  return (
    <Chart
      {...chartProps}
      definition={defineChart(
        {
          marks: [
            barY(points, {
              radius: chartGeometry.barRadius,
              x: "id",
              y: "value",
              fill,
              inset: barCategoryGap / 2,
              maxThickness: barSize,
            }),
          ],
          guides: false,
          margin: 0,
          scales: { x: { scale: () => scaleBand<string>().padding(0) }, y: { scale: scaleLinear } },
        },
        { tooltip: { use: tooltip } },
      )}
    />
  );
};

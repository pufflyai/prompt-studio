import { Box, chakra, Text, useSlotRecipe } from "@chakra-ui/react";
import type { DataTableRendererChartOptions } from "@pstdio/sdk/extensions";
import { readDataTableChartValue } from "pstdio-api-contracts/collections";
import { dataTableRecipe } from "@/theme/recipes/data-table";
import psTheme from "@/theme/theme";
import { chartGeometry } from "./data-table-chart-geometry";
import { dataTableChartText, formatDataTableChartValue } from "./data-table-chart-text";

interface DataTableChartCellProps {
  value: unknown;
  renderer: DataTableRendererChartOptions;
  label: string;
}
const chartColor = (token: string) => psTheme.token.var(`colors.${token}`);

export const DataTableChartCell = (props: DataTableChartCellProps) => {
  const { value, renderer, label } = props;
  const styles = useSlotRecipe({ recipe: dataTableRecipe })();
  const data = readDataTableChartValue(value);
  if (!data?.values.some((point) => point !== null))
    return (
      <Text color="fg.muted" textStyle="label/XS">
        No data
      </Text>
    );
  const format = (value: number) => formatDataTableChartValue(value, renderer.unit);
  const summary = `${label}: ${dataTableChartText(value, renderer).join(", ")}`;
  const geometry = chartGeometry(data, renderer);
  const color = chartColor("vis.categorical.1");
  return (
    <Box css={styles.chart} role="img" aria-label={summary} data-table-chart={renderer.type}>
      {renderer.type === "sparkline" ? (
        <chakra.svg css={styles.sparkline} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <title>{summary}</title>
          {geometry.segments.map((segment, index) => (
            <polyline
              key={index}
              points={segment}
              fill="none"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {geometry.points
            .filter((point, index) => point !== null && !geometry.points[index - 1] && !geometry.points[index + 1])
            .map(
              (point) =>
                point && (
                  <line
                    key={point.index}
                    x1={point.x - 1}
                    x2={point.x + 1}
                    y1={point.y}
                    y2={point.y}
                    stroke={color}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                ),
            )}
        </chakra.svg>
      ) : (
        geometry.points
          .filter((point) => point !== null)
          .map((point) => (
            <Box key={point.index} css={styles.bar}>
              <Text css={styles.label}>{point.label}</Text>
              <chakra.svg css={styles.barPlot} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                <title>{`${point.label}: ${format(point.value)}`}</title>
                <line
                  x1={geometry.zero}
                  x2={geometry.zero}
                  y1="0"
                  y2="10"
                  stroke={chartColor("border.subtle")}
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={point.start}
                  y="1"
                  width={point.width}
                  height="8"
                  rx="1"
                  fill={chartColor(`vis.categorical.${(point.index % 14) + 1}`)}
                />
              </chakra.svg>
              <Text css={styles.value}>{format(point.value)}</Text>
            </Box>
          ))
      )}
    </Box>
  );
};

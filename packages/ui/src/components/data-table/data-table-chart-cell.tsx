import { Box, chakra, Text, useSlotRecipe } from "@chakra-ui/react";
import type { DataTableRendererChartOptions } from "@pstdio/sdk/extensions";
import { readDataTableChartValue } from "pstdio-api-contracts/collections";
import { useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";
import { dataTableRecipe } from "@/theme/recipes/data-table";
import psTheme from "@/theme/theme";
import { chartBarPath, chartGeometry } from "./data-table-chart-geometry";
import { dataTableChartText } from "./data-table-chart-text";

interface DataTableChartCellProps {
  value: unknown;
  renderer: DataTableRendererChartOptions;
  label: string;
}
const chartColor = (token: string) => psTheme.token.var(`colors.${token}`);

export const DataTableChartCell = (props: DataTableChartCellProps) => {
  const { value, renderer, label } = props;
  const styles = useSlotRecipe({ recipe: dataTableRecipe })();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const data = readDataTableChartValue(value);
  if (!data?.values.some((point) => point !== null))
    return (
      <Text color="fg.muted" textStyle="label/XS">
        No data
      </Text>
    );
  const descriptions = dataTableChartText(value, renderer);
  const tooltipText = dataTableChartText(value, renderer, hoveredIndex);
  const summary = `${label}: ${descriptions.join(", ")}`;
  const geometry = chartGeometry(data, renderer);
  const color = chartColor("vis.categorical.1");
  return (
    <Tooltip
      content={
        <Box>
          {tooltipText.map((description, index) => (
            <Box key={index}>{description}</Box>
          ))}
        </Box>
      }
    >
      <Box
        css={styles.chart}
        role="img"
        aria-label={summary}
        tabIndex={0}
        data-table-chart={renderer.type}
        onPointerLeave={() => setHoveredIndex(null)}
        onFocus={() => setHoveredIndex(null)}
      >
        {renderer.type === "sparkline" ? (
          <chakra.svg
            css={styles.sparkline}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const position = ((event.clientX - bounds.left) / bounds.width - 0.04) / 0.92;
              setHoveredIndex(
                Math.max(0, Math.min(data.values.length - 1, Math.round(position * (data.values.length - 1)))),
              );
            }}
          >
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
              <Box key={point.index} css={styles.bar} onPointerEnter={() => setHoveredIndex(point.index)}>
                <chakra.svg css={styles.barPlot} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                  <line
                    x1={geometry.zero}
                    x2={geometry.zero}
                    y1="0"
                    y2="10"
                    stroke={chartColor("border.subtle")}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path d={chartBarPath(point)} fill={chartColor(`vis.categorical.${(point.index % 14) + 1}`)} />
                </chakra.svg>
              </Box>
            ))
        )}
      </Box>
    </Tooltip>
  );
};

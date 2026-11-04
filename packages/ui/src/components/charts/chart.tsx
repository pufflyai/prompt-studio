import { Box, type BoxProps, useSlotRecipe } from "@chakra-ui/react";
import type { ChartBuildContext, ChartValue } from "@tanstack/charts";
import { Chart as TanStackChart, type ChartProps as TanStackChartProps } from "@tanstack/charts/react/tooltip";
import psTheme from "@/theme/theme";

export const chartColor = (token: string) => psTheme.token.var(`colors.${token}`);
export const chartPalette = Array.from({ length: 7 }, (_, index) => chartColor(`vis.categorical.${index + 1}`));
const theme = {
  foreground: chartColor("vis.axis"),
  muted: chartColor("vis.text.secondary"),
  grid: chartColor("vis.grid"),
  background: chartColor("bg"),
  palette: chartPalette,
};

export type ChartProps<T, X extends ChartValue = ChartValue, Y extends ChartValue = ChartValue> = Omit<
  TanStackChartProps<T, X, Y>,
  "height"
> & { height?: BoxProps["height"] };

// TanStack's host requires a CSS height to fill a bounded panel.
const fill = { height: "100%" };

export function Chart<T, X extends ChartValue = ChartValue, Y extends ChartValue = ChartValue>(
  props: ChartProps<T, X, Y>,
) {
  const { definition, height = "full", style, renderTooltipBody, ...rest } = props;
  const styles = useSlotRecipe({ recipe: psTheme.getSlotRecipe("chart") })();
  const themed =
    "chart" in definition
      ? {
          ...definition,
          chart: (context: ChartBuildContext) => {
            const spec = definition.chart(context);
            return { ...spec, theme: { ...theme, ...spec.theme } };
          },
        }
      : { ...definition, theme: { ...theme, ...definition.theme } };
  return (
    <Box css={styles.root} height={typeof height === "number" ? `${height}px` : height} data-pstdio-chart>
      <TanStackChart
        {...rest}
        definition={themed}
        style={{ ...fill, ...style }}
        renderTooltipBody={
          renderTooltipBody
            ? (context) => (
                <Box css={styles.tooltip} data-chart-tooltip>
                  {renderTooltipBody(context)}
                </Box>
              )
            : undefined
        }
      />
    </Box>
  );
}

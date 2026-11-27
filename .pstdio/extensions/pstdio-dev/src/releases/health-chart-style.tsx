import { Box, defineStyle, Stack, type StackProps } from "@chakra-ui/react";
import type { DashboardColorSettings, DashboardWidgetAppearance } from "@pstdio/ui/dashboard-renderer";
import type { ChartValue } from "@tanstack/charts";
import { Chart, type ChartProps } from "@tanstack/charts/react";
import { createContext, type ReactNode, useContext } from "react";

export const releaseHealthChartLayout = defineStyle({
  "& [data-scope=scroll-area][data-part=content]:has(> [data-release-health-chart])": {
    display: "flex",
    flexDirection: "column",
    // Fill the widget viewport and let short widgets scroll once their plot reaches its minimum height.
    flex: "1 0 auto",
  },
});

export function HealthChartFrame(props: StackProps) {
  return <Stack data-release-health-chart="" flex="1" gap="2xs" {...props} />;
}

export function HealthPlot<T, X extends ChartValue, Y extends ChartValue>(
  props: Omit<ChartProps<T, X, Y>, "height" | "aspectRatio" | "style">,
) {
  // Keep the rendered SVG from setting the plot's intrinsic size during widget resize.
  return (
    <Box flex="1" minH="24" contain="size" color="fg.muted" textStyle="label/XS">
      <Chart {...props} style={{ height: "100%" }} />
    </Box>
  );
}

const Appearance = createContext<DashboardWidgetAppearance>({ seriesColors: {} });
export const useHealthChartAppearance = () => useContext(Appearance);

export const healthChart = (content: ReactNode) => (appearance: DashboardWidgetAppearance) => (
  <Appearance.Provider value={appearance}>{content}</Appearance.Provider>
);

export const seriesColorSettings = (
  label: string,
  series: readonly { id: string; label: string }[],
): DashboardColorSettings => ({
  label: `${label} color`,
  series: {
    label,
    keys: series.map(({ id }) => id),
    names: Object.fromEntries(series.map(({ id, label }) => [id, label])),
  },
});

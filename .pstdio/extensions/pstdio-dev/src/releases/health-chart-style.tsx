import type { DashboardColorSettings, DashboardWidgetAppearance } from "@pstdio/ui/dashboard-renderer";
import { createContext, type ReactNode, useContext } from "react";

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

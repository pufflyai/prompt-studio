import { Text } from "@chakra-ui/react";
import { colorLegend, defineChart } from "@tanstack/charts";
import { pie, polar, radialArc } from "@tanstack/charts/polar";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@/components/charts/chart";
import type { DashboardSeriesPoint } from "./dashboard-types";

const number = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 17 });
const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

export function DashboardRingChart(props: { label: string; series?: DashboardSeriesPoint[] }) {
  const { label, series = [] } = props;
  const totals = new Map<string, number>();
  for (const point of series) {
    if (Number.isFinite(point.value) && point.value > 0) {
      totals.set(point.label, (totals.get(point.label) ?? 0) + point.value);
    }
  }
  const values = Array.from(totals, ([label, value]) => ({ label, value }));
  if (!values.length)
    return (
      <Text color="fg.muted" textStyle="label/S/regular">
        No ring chart data
      </Text>
    );
  const slices = pie(values, { value: "value" });
  const arcs = radialArc(slices, { innerRadius: ({ radius }) => radius * 0.6, color: "label", key: "label" });
  return (
    <Chart
      ariaLabel={label}
      definition={defineChart(
        {
          marks: [polar({ radiusRatio: 0.8, marks: [arcs], scales: { angle: null, radius: null } })],
          scales: { x: null, y: null },
          color: { domain: Array.from(totals.keys()).sort(), legend: colorLegend({ placement: "bottom" }) },
        },
        {
          keyboard: true,
          tooltip: {
            use: tooltip,
            portal,
            content: ([point]) => {
              if (!point) return { rows: [] };
              return {
                title: point.datum.label,
                rows: [
                  { label: "Value", value: number.format(point.datum.value), color: point.color },
                  { label: "Share", value: percent.format(point.datum.fraction) },
                ],
              };
            },
          },
        },
      )}
    />
  );
}

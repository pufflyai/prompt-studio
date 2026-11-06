import { HStack, Stack, Text } from "@chakra-ui/react";
import { Chart, chartColor } from "@pstdio/ui/charts";
import { defineChart, dot, lineY, ruleY } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { type FormulaResult, formatMoney } from "../../services/financial-formulas";

export const FormulaPlot = (props: { result: FormulaResult; years: number }) => {
  const { result, years } = props;
  const all = [...result.values, ...result.comparison];
  const minimum = Math.min(0, ...all);
  const maximum = Math.max(1, ...all);
  const primary = result.values.map((value, index) => ({
    year: (index * years) / Math.max(1, result.values.length - 1),
    value,
  }));
  const comparison = result.comparison.map((value, index) => ({
    year: (index * years) / Math.max(1, result.comparison.length - 1),
    value,
  }));
  const definition = defineChart(
    {
      marks: [
        ruleY([0], { stroke: chartColor("vis.grid") }),
        lineY(comparison, { x: "year", y: "value", stroke: chartColor("vis.categorical.2"), strokeDasharray: "4 4" }),
        lineY(primary, { x: "year", y: "value", stroke: chartColor("vis.categorical.1"), strokeWidth: 2 }),
        dot(primary.slice(-1), { x: "year", y: "value", fill: chartColor("vis.categorical.1") }),
      ],
      guides: false,
      scales: { x: { scale: scaleLinear }, y: { scale: scaleLinear().domain([minimum, maximum]) } },
    },
    {
      tooltip: {
        use: tooltip,
        format: ({ datum }) => `Year ${Number(datum.year.toFixed(1))}: ${formatMoney(datum.value)}`,
      },
    },
  );
  return (
    <Stack gap="xs">
      <HStack justify="space-between" textStyle="label/XS/regular" color="fg.muted">
        <Text>{formatMoney(minimum)}</Text>
        <Text>{formatMoney(maximum)}</Text>
      </HStack>
      <Chart definition={definition} height="56" ariaLabel={`${result.chartLabel} over ${years} years`} />
      <HStack justify="space-between" textStyle="label/XS/regular" color="fg.muted">
        <Text>Today</Text>
        <Text>Year {years}</Text>
      </HStack>
      <HStack gap="md" flexWrap="wrap" textStyle="label/XS/regular">
        <Text color="vis.categorical.1">━ {result.chartLabel}</Text>
        <Text color="vis.categorical.2">┄ {result.comparisonLabel}</Text>
      </HStack>
    </Stack>
  );
};

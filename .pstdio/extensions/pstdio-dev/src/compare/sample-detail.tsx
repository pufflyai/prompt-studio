import { Box, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { psTheme, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { defineChart, dot, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import type { CompareRow } from "../benchmarks/analysis";
import { formatRange, formatValue, shortSha } from "../webview/format";
import { BASE_COLOR, HEAD_COLOR } from "./results-table";

interface SampleDetailProps {
  row: CompareRow;
  base: string;
  head: string;
}

interface Sample {
  commit: "Base" | "Head";
  sample: number;
  value: number;
}

const token = (name: string) => psTheme.token.var(`colors.${name}`);
// One color scale keeps base and head in the same colors in both charts and the legend.
const commitColors = { domain: ["Base", "Head"], range: [token(BASE_COLOR), token(HEAD_COLOR)] };

interface LegendProps {
  base: string;
  head: string;
}

const Legend = (props: LegendProps) => (
  <HStack gap="md" textStyle="label/XS" color="fg.muted">
    <HStack gap="2xs">
      <Box boxSize="2.5" borderRadius="full" bg={BASE_COLOR} />
      <Text>Base {shortSha(props.base)}</Text>
    </HStack>
    <HStack gap="2xs">
      <Box boxSize="2.5" borderRadius="full" bg={HEAD_COLOR} />
      <Text>Head {shortSha(props.head)}</Text>
    </HStack>
  </HStack>
);

// Every sample stays visible: the spread shows noise, and run order shows drift or warm-up.
export const SampleDetail = (props: SampleDetailProps) => {
  const { row, base, head } = props;
  const samples: Sample[] = [
    ...(row.base?.values ?? []).map((value, sample) => ({ commit: "Base" as const, sample: sample + 1, value })),
    ...(row.head?.values ?? []).map((value, sample) => ({ commit: "Head" as const, sample: sample + 1, value })),
  ];
  const values = samples.map((sample) => sample.value);
  const domain = [Math.min(...values) * 0.95, Math.max(...values) * 1.05];
  const format = (value: number) => formatValue(value, row.unit);
  const strip = defineChart({
    color: commitColors,
    marks: [dot(samples, { x: "value", y: "commit", color: "commit", r: 4, fillOpacity: 0.85 })],
    scales: {
      x: { scale: () => scaleLinear().domain(domain), axis: { ticks: { format } } },
      y: { scale: () => scaleBand<string>().domain(["Base", "Head"]).padding(0.3) },
    },
  });
  const order = defineChart({
    color: commitColors,
    marks: [
      lineY(samples, { x: "sample", y: "value", z: "commit", color: "commit", strokeWidth: 2 }),
      dot(samples, { x: "sample", y: "value", color: "commit", r: 3 }),
    ],
    scales: {
      x: { scale: () => scaleLinear().domain([1, Math.max(1, ...samples.map((sample) => sample.sample))]) },
      y: { scale: () => scaleLinear().domain(domain), grid: true, axis: { ticks: { format } } },
    },
  });
  return (
    <Grid templateColumns="repeat(auto-fit, minmax(22rem, 1fr))" gap="md">
      <SimpleCard>
        <SimpleCardBody display="flex" flexDirection="column" gap="sm">
          <Stack gap="2xs">
            <Text textStyle="label/S/regular" color="fg.muted">
              {row.suiteLabel} · {row.source}
            </Text>
            <Text textStyle="heading/S">{row.label}: every sample</Text>
          </Stack>
          <Legend base={base} head={head} />
          <Box color="fg.muted" textStyle="label/XS">
            <Chart definition={strip} height={140} ariaLabel={`Samples of ${row.label} for base and head`} />
          </Box>
          {(["base", "head"] as const).map((side) =>
            row[side] ? (
              <Text key={side} textStyle="label/S/regular" color="fg.muted">
                {side === "base" ? "Base" : "Head"} median {format(row[side].median)}, 95% CI{" "}
                {formatRange(row[side].low, row[side].high, row.unit)}
              </Text>
            ) : null,
          )}
        </SimpleCardBody>
      </SimpleCard>
      <SimpleCard>
        <SimpleCardBody display="flex" flexDirection="column" gap="sm">
          <Stack gap="2xs">
            <Text textStyle="label/S/regular" color="fg.muted">
              Checks for drift and warm-up
            </Text>
            <Text textStyle="heading/S">Samples in run order</Text>
          </Stack>
          <Legend base={base} head={head} />
          <Box color="fg.muted" textStyle="label/XS">
            <Chart definition={order} height={180} ariaLabel={`Samples of ${row.label} in run order`} />
          </Box>
        </SimpleCardBody>
      </SimpleCard>
    </Grid>
  );
};

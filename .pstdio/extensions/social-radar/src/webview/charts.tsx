import { Box, HStack, Text } from "@chakra-ui/react";
import { barX, barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import type { Sentiment } from "../schemas";

// Charts paint with theme tokens, so they follow the light and dark themes.
const token = (name: string) => `var(--chakra-colors-${name.replace(".", "-")})`;
const countColor = token("blue.solid");
export const sentimentTokens: Record<Sentiment, string> = {
  negative: "red.solid",
  neutral: "gray.emphasized",
  positive: "blue.solid",
};
const sentimentLabels: Record<Sentiment, string> = { negative: "Negative", neutral: "Neutral", positive: "Positive" };

interface DailyBarsProps {
  days: { day: string; count: number }[];
  label: string;
}
export const DailyBars = (props: DailyBarsProps) => {
  const { days, label } = props;
  const definition = defineChart({
    marks: [barY(days, { x: "day", y: "count", fill: countColor, inset: 4, radius: 2 })],
    scales: {
      x: {
        scale: () => scaleBand<string>().padding(0.2),
        axis: { ticks: { format: (value: string) => String(Number(value.slice(8))) } },
      },
      y: { scale: scaleLinear, nice: true, axis: false },
    },
  });
  return (
    <Box color="fg.muted" textStyle="label/XS">
      <Chart definition={definition} height={200} ariaLabel={label} />
    </Box>
  );
};

interface RankedBarsProps {
  rows: { label: string; count: number }[];
  label: string;
}
export const RankedBars = (props: RankedBarsProps) => {
  const { rows, label } = props;
  const definition = defineChart({
    marks: [barX(rows, { x: "count", y: "label", fill: countColor, maxThickness: 10, radius: 2 })],
    scales: {
      x: { scale: scaleLinear, nice: true, axis: false },
      y: {
        scale: () =>
          scaleBand<string>()
            .domain(rows.map((row) => row.label))
            .padding(0.3),
      },
    },
  });
  return (
    <Box color="fg.muted" textStyle="label/XS">
      <Chart definition={definition} height={Math.max(rows.length * 24, 48)} ariaLabel={label} />
    </Box>
  );
};

interface SentimentBarProps {
  counts: Record<Sentiment, number>;
  label: string;
}
export const SentimentBar = (props: SentimentBarProps) => {
  const { counts, label } = props;
  const rows = (["negative", "neutral", "positive"] as const).map((sentiment) => ({
    sentiment,
    row: label,
    count: counts[sentiment],
  }));
  const definition = defineChart({
    marks: [
      barX(rows, {
        x: "count",
        y: "row",
        z: "sentiment",
        fill: (row) => token(sentimentTokens[row.sentiment]),
        inset: 1,
      }),
    ],
    scales: {
      x: { scale: scaleLinear, axis: false },
      y: { scale: () => scaleBand<string>().padding(0), axis: false },
    },
  });
  return (
    <Box>
      <Chart definition={definition} height={12} ariaLabel={label} />
      <HStack gap="md" mt="xs">
        {rows.map((row) => (
          <HStack key={row.sentiment} gap="2xs">
            <Box boxSize="2" borderRadius="2xs" bg={sentimentTokens[row.sentiment]} />
            <Text textStyle="label/XS" color="fg.muted">
              {sentimentLabels[row.sentiment]} {row.count}
            </Text>
          </HStack>
        ))}
      </HStack>
    </Box>
  );
};

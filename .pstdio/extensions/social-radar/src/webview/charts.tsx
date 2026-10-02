import { Box, HStack, Text } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { barX, barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import type { ReactNode } from "react";
import type { Sentiment } from "../schemas";

// Charts paint with theme tokens, so they follow the light and dark themes.
const token = (name: string) => psTheme.token.var(`colors.${name}`);
const countColor = token("blue.solid");
export const sentimentTokens: Record<Sentiment, string> = {
  negative: "red.solid",
  neutral: "gray.emphasized",
  positive: "blue.solid",
};
const sentimentLabels: Record<Sentiment, string> = { negative: "Negative", neutral: "Neutral", positive: "Positive" };
// The chart's own sizing API: without a height prop, style.height lets the chart follow the box it sits in,
// so the dashboard scales with the page. A CSS rule cannot do this, because the chart sets its height inline.
const fillHeight = { height: "100%" };

interface ChartBoxProps {
  height?: number;
  children: ReactNode;
}
const ChartBox = (props: ChartBoxProps) => {
  const { height, children } = props;
  if (height)
    return (
      <Box color="fg.muted" textStyle="label/XS">
        {children}
      </Box>
    );
  return (
    <Box color="fg.muted" textStyle="label/XS" flex="1" minH="0" overflow="hidden">
      {children}
    </Box>
  );
};

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
    <ChartBox>
      <Chart definition={definition} ariaLabel={label} style={fillHeight} />
    </ChartBox>
  );
};

interface RankedBarsProps {
  rows: { label: string; count: number }[];
  label: string;
  // Fixed rows suit a scrolling column; omit to fill the parent's height.
  fixedHeight?: boolean;
}
export const RankedBars = (props: RankedBarsProps) => {
  const { rows, label, fixedHeight = false } = props;
  const height = fixedHeight ? Math.max(rows.length * 24, 48) : undefined;
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
    <ChartBox height={height}>
      <Chart definition={definition} height={height} ariaLabel={label} style={height ? undefined : fillHeight} />
    </ChartBox>
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

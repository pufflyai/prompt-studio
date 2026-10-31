import { Box, HStack } from "@chakra-ui/react";

export interface MetricBar {
  value: number | null;
  // A timeout or restart takes a full-height bar in its own color.
  flag?: "warning" | "error";
}

interface MetricBarsProps {
  // One series per process, drawn side by side in each column.
  series: MetricBar[][];
  colors: string[];
  count: number;
  height: string;
}

const flagColor = { warning: "fg.warning", error: "fg.error" } as const;

// Columns share the frame-rate bars' clock: newest on the right, missing readings as a flat line.
export const MetricBars = (props: MetricBarsProps) => {
  const { series, colors, count, height } = props;
  const max = Math.max(1, ...series.flat().map((bar) => bar.value ?? 0));
  const padded = series.map((bars) => {
    const recent = bars.slice(-count);
    return [...Array<MetricBar | undefined>(count - recent.length).fill(undefined), ...recent];
  });
  return (
    <HStack h={height} gap="3xs" alignItems="end" aria-hidden>
      {Array.from({ length: count }, (_, column) => (
        // Columns are positional; a sample has no identity of its own here.
        <HStack key={column} flex="1" h="full" gap="performance-bar-gap" alignItems="end">
          {padded.map((bars, index) => {
            const bar = bars[column];
            let color = bar?.value === null || !bar ? "border" : colors[index];
            if (bar?.flag) color = flagColor[bar.flag];
            let size = 8;
            if (bar?.flag) size = 100;
            else if (bar?.value != null) size = Math.max(8, (bar.value / max) * 100);
            return (
              // Series are positional too: the first is always the backend.
              <Box key={index} flex="1" h={`${size}%`} bg={color} borderTopRadius="2xs" />
            );
          })}
        </HStack>
      ))}
    </HStack>
  );
};

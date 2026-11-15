import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import type { ProjectSetup, StartupStep } from "../diagnostics/timeline";

export const formatMs = (ms: number | null) => {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`;
};

interface Bar {
  key: string;
  label: string;
  startMs: number;
  durationMs: number | null;
  state: "completed" | "failed" | "running";
  depth: number;
}

const fill = { completed: "vis.categorical.1", failed: "fg.error", running: "fg.muted" } as const;

const Bars = (props: { bars: Bar[]; totalMs: number }) => {
  const { bars, totalMs } = props;
  const span = Math.max(totalMs, ...bars.map((bar) => bar.startMs + (bar.durationMs ?? 0)), 1);
  const slowest = Math.max(...bars.map((bar) => bar.durationMs ?? 0));
  return (
    <Stack gap="3xs">
      {bars.map((bar) => {
        const width = ((bar.durationMs ?? span - bar.startMs) / span) * 100;
        return (
          <Flex key={bar.key} align="center" gap="sm" minW="0">
            <Text
              textStyle="label/S/regular"
              w="14rem"
              flexShrink={0}
              pl={`${bar.depth * 12}px`}
              truncate
              fontWeight={bar.durationMs === slowest && slowest > 0 ? "semibold" : undefined}
            >
              {bar.label}
            </Text>
            <Box flex="1" minW="0" h="10px" position="relative" bg="bg.subtle" borderRadius="xs">
              <Box
                position="absolute"
                top="0"
                bottom="0"
                left={`${(bar.startMs / span) * 100}%`}
                w={`max(2px, ${width}%)`}
                bg={fill[bar.state]}
                borderRadius="xs"
              />
            </Box>
            <Text textStyle="label/S/regular" color="fg.muted" w="6rem" flexShrink={0} textAlign="right">
              {bar.state === "running" ? "unfinished" : formatMs(bar.durationMs)}
            </Text>
          </Flex>
        );
      })}
    </Stack>
  );
};

/** Each startup step ends at its logged elapsed time, so steps sit end to end. */
export const StartupWaterfall = (props: { steps: StartupStep[] }) => {
  const { steps } = props;
  const bars = steps.map((step) => ({
    key: step.phase,
    label: step.phase,
    startMs: step.atMs - step.durationMs,
    durationMs: step.durationMs,
    state: "completed" as const,
    depth: 0,
  }));
  return <Bars bars={bars} totalMs={steps.at(-1)?.atMs ?? 0} />;
};

export const SetupWaterfall = (props: { setup: ProjectSetup }) => {
  const { setup } = props;
  const bars = setup.steps.map((step, index) => ({ ...step, key: `${index}`, label: step.phase }));
  return <Bars bars={bars} totalMs={setup.durationMs ?? 0} />;
};

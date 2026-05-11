import { Badge, Box, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { type ChatMountMetric, readLatestChatMountMetric } from "./chat-mount-metrics";

export type ChatPerfSample = {
  scenario: string;
  phase: string;
  actualDuration: number;
  baseDuration: number;
  commitTime: number;
};

type ChatPerfFrameRate = {
  value: number | null;
  averageValue: number | null;
  samples: number[];
  startedAtMs: number;
  totalFrames: number;
};

type PanelSnapshot = {
  latestMountMetric: ChatMountMetric | null;
  framesPerSecond: number | null;
  averageFramesPerSecond: number | null;
  frameRateSamples: number[];
};

declare global {
  interface Window {
    __chatPanelPerf?: ChatPerfSample[];
    __chatPanelFrameRate?: ChatPerfFrameRate;
    __chatPanelFrameRateSamplerInstalled?: boolean;
  }
}

const FPS_SAMPLE_LIMIT = 60;
const SPARKLINE_WIDTH = 132;
const SPARKLINE_HEIGHT = 28;

export const ensureChatPerfBuffer = () => {
  if (typeof window === "undefined") return null;
  window.__chatPanelPerf ??= [];
  return window.__chatPanelPerf;
};

const createFrameRateState = (now: number): ChatPerfFrameRate => ({
  value: null,
  averageValue: null,
  samples: [],
  startedAtMs: now,
  totalFrames: 0,
});

const ensureFrameRateState = () => {
  const now = performance.now();
  window.__chatPanelFrameRate ??= createFrameRateState(now);
  window.__chatPanelFrameRate.averageValue ??= null;
  window.__chatPanelFrameRate.samples ??= [];
  window.__chatPanelFrameRate.startedAtMs ??= now;
  window.__chatPanelFrameRate.totalFrames ??= 0;
  return window.__chatPanelFrameRate;
};

const installFrameRateSampler = () => {
  if (typeof window === "undefined") return;
  if (window.__chatPanelFrameRateSamplerInstalled) return;

  ensureFrameRateState();
  window.__chatPanelFrameRateSamplerInstalled = true;

  let frames = 0;
  let sampleStartedAt = performance.now();

  const sample = (now: number) => {
    const frameRate = ensureFrameRateState();

    frames += 1;
    frameRate.totalFrames += 1;

    const elapsedMs = now - sampleStartedAt;
    const recordingElapsedMs = now - frameRate.startedAtMs;
    frameRate.averageValue = recordingElapsedMs > 0 ? (frameRate.totalFrames * 1000) / recordingElapsedMs : null;

    if (elapsedMs >= 500) {
      const value = (frames * 1000) / elapsedMs;
      const samples = frameRate.samples;
      samples.push(value);

      if (samples.length > FPS_SAMPLE_LIMIT) {
        samples.splice(0, samples.length - FPS_SAMPLE_LIMIT);
      }

      frameRate.value = value;
      frames = 0;
      sampleStartedAt = now;
    }

    window.requestAnimationFrame(sample);
  };

  window.requestAnimationFrame(sample);
};

const readPanelSnapshot = (scenario: string): PanelSnapshot => {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return {
      latestMountMetric: null,
      framesPerSecond: null,
      averageFramesPerSecond: null,
      frameRateSamples: [],
    };
  }
  const frameRate = window.__chatPanelFrameRate;

  return {
    latestMountMetric: readLatestChatMountMetric(scenario),
    framesPerSecond: frameRate?.value ?? null,
    averageFramesPerSecond: frameRate?.averageValue ?? null,
    frameRateSamples: frameRate?.samples.slice(-FPS_SAMPLE_LIMIT) ?? [],
  };
};

const formatMs = (value: number | null) => {
  if (value === null) return "pending";
  if (value < 10) return `${value.toFixed(2)} ms`;
  return `${Math.round(value)} ms`;
};

const formatFps = (value: number | null) => {
  if (value === null) return "pending";
  if (value < 10) return `${value.toFixed(1)} fps`;
  return `${Math.round(value)} fps`;
};

const buildSparklinePoints = (samples: number[]) => {
  if (samples.length === 0) return "";

  const maxFps = Math.max(60, ...samples);
  const xStep = samples.length > 1 ? SPARKLINE_WIDTH / (samples.length - 1) : 0;

  return samples
    .map((sample, index) => {
      const x = index * xStep;
      const clamped = Math.max(0, Math.min(sample, maxFps));
      const y = SPARKLINE_HEIGHT - (clamped / maxFps) * SPARKLINE_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

const Metric = (props: { label: string; value: string }) => {
  const { label, value } = props;

  return (
    <Stack gap="0">
      <Text textStyle="label/XS/regular" color="fg.muted">
        {label}
      </Text>
      <Text textStyle="label/S/medium" color="fg" fontFamily="mono">
        {value}
      </Text>
    </Stack>
  );
};

const FpsSparkline = (props: { samples: number[] }) => {
  const { samples } = props;
  const points = buildSparklinePoints(samples);

  return (
    <Box w="full" h="28px" color="fg.info">
      <svg
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        width="100%"
        height="100%"
        aria-label="FPS over time"
        role="img"
      >
        <line
          x1="0"
          x2={SPARKLINE_WIDTH}
          y1={SPARKLINE_HEIGHT - 0.5}
          y2={SPARKLINE_HEIGHT - 0.5}
          stroke="currentColor"
          strokeOpacity="0.18"
        />
        {points ? (
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </Box>
  );
};

const FpsMetric = (props: { value: number | null; averageValue: number | null; samples: number[] }) => {
  const { value, averageValue, samples } = props;

  return (
    <Stack gap="xxs" minW="0">
      <Metric label="FPS" value={formatFps(value)} />
      <Text textStyle="label/XS/regular" color="fg.muted" fontFamily="mono">
        Avg {formatFps(averageValue)}
      </Text>
      <FpsSparkline samples={samples} />
    </Stack>
  );
};

export const ChatPerformancePanel = (props: { scenario: string; messageCount: number }) => {
  const { scenario, messageCount } = props;
  const [snapshot, setSnapshot] = useState(() => readPanelSnapshot(scenario));
  const latestMountMetric = snapshot.latestMountMetric;

  useEffect(() => {
    ensureChatPerfBuffer();
    installFrameRateSampler();
    setSnapshot(readPanelSnapshot(scenario));

    const intervalId = window.setInterval(() => {
      setSnapshot(readPanelSnapshot(scenario));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [scenario]);

  return (
    <Box
      flex="1"
      minW="420px"
      maxW="720px"
      borderWidth="1px"
      borderColor="border"
      borderRadius="sm"
      bg="bg"
      boxShadow="lg"
      p="sm"
      data-testid="chat-perf-panel"
    >
      <Stack gap="sm">
        <HStack justify="space-between" align="center">
          <Stack gap="0">
            <Text textStyle="label/S/medium">Performance</Text>
            <Text textStyle="label/XS/regular" color="fg.muted">
              {latestMountMetric?.label ?? "mount pending"}
            </Text>
          </Stack>
          <Badge size="sm" variant="subtle">
            {messageCount} messages
          </Badge>
        </HStack>

        <SimpleGrid columns={3} gap="xs">
          <Metric label="Mount total" value={formatMs(latestMountMetric?.totalMs ?? null)} />
          <Metric label="Mount / message" value={formatMs(latestMountMetric?.perMessageMs ?? null)} />
          <FpsMetric
            value={snapshot.framesPerSecond}
            averageValue={snapshot.averageFramesPerSecond}
            samples={snapshot.frameRateSamples}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
};

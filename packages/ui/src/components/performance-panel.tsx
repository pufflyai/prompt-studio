import { Badge, Box, type BoxProps, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";

const SPARKLINE_WIDTH = 132;
const SPARKLINE_HEIGHT = 28;
const FPS_SAMPLE_LIMIT = 60;

type PerformanceFrameRate = {
  value: number | null;
  averageValue: number | null;
  samples: number[];
  startedAtMs: number;
  totalFrames: number;
};

export interface PerformanceFrameRateSnapshot {
  framesPerSecond: number | null;
  averageFramesPerSecond: number | null;
  frameRateSamples: number[];
}

declare global {
  interface Window {
    __performancePanelFrameRate?: PerformanceFrameRate;
    __performancePanelFrameRateSamplerInstalled?: boolean;
  }
}

export interface PerformancePanelMetric {
  label: string;
  value: string;
}

interface PerformancePanelProps {
  title?: string;
  subtitle: string;
  badgeLabel: string;
  metrics: PerformancePanelMetric[];
  framesPerSecond?: number | null;
  averageFramesPerSecond?: number | null;
  frameRateSamples?: number[];
  rootProps?: BoxProps;
  testId?: string;
}

export const formatPerformanceMs = (value: number | null) => {
  if (value === null) return "pending";
  if (value < 10) return `${value.toFixed(2)} ms`;
  return `${Math.round(value)} ms`;
};

export const formatPerformanceFps = (value: number | null) => {
  if (value === null) return "pending";
  if (value < 10) return `${value.toFixed(1)} fps`;
  return `${Math.round(value)} fps`;
};

const createFrameRateState = (now: number): PerformanceFrameRate => ({
  value: null,
  averageValue: null,
  samples: [],
  startedAtMs: now,
  totalFrames: 0,
});

const ensureFrameRateState = () => {
  const now = performance.now();
  window.__performancePanelFrameRate ??= createFrameRateState(now);
  window.__performancePanelFrameRate.averageValue ??= null;
  window.__performancePanelFrameRate.samples ??= [];
  window.__performancePanelFrameRate.startedAtMs ??= now;
  window.__performancePanelFrameRate.totalFrames ??= 0;
  return window.__performancePanelFrameRate;
};

export const installPerformanceFrameRateSampler = () => {
  if (typeof window === "undefined") return;
  if (window.__performancePanelFrameRateSamplerInstalled) return;

  ensureFrameRateState();
  window.__performancePanelFrameRateSamplerInstalled = true;

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

export const readPerformanceFrameRateSnapshot = (): PerformanceFrameRateSnapshot => {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return {
      framesPerSecond: null,
      averageFramesPerSecond: null,
      frameRateSamples: [],
    };
  }

  const frameRate = window.__performancePanelFrameRate;

  return {
    framesPerSecond: frameRate?.value ?? null,
    averageFramesPerSecond: frameRate?.averageValue ?? null,
    frameRateSamples: frameRate?.samples.slice(-FPS_SAMPLE_LIMIT) ?? [],
  };
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

const Metric = (props: PerformancePanelMetric) => {
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
      <Metric label="FPS" value={formatPerformanceFps(value)} />
      <Text textStyle="label/XS/regular" color="fg.muted" fontFamily="mono">
        Avg {formatPerformanceFps(averageValue)}
      </Text>
      <FpsSparkline samples={samples} />
    </Stack>
  );
};

export const PerformancePanel = (props: PerformancePanelProps) => {
  const {
    title = "Performance",
    subtitle,
    badgeLabel,
    metrics,
    framesPerSecond = null,
    averageFramesPerSecond = null,
    frameRateSamples = [],
    rootProps,
    testId = "performance-panel",
  } = props;

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
      data-testid={testId}
      {...rootProps}
    >
      <Stack gap="sm">
        <HStack justify="space-between" align="center">
          <Stack gap="0">
            <Text textStyle="label/S/medium">{title}</Text>
            <Text textStyle="label/XS/regular" color="fg.muted">
              {subtitle}
            </Text>
          </Stack>
          <Badge size="sm" variant="subtle" bg="bg.muted" color="fg.muted">
            {badgeLabel}
          </Badge>
        </HStack>

        <SimpleGrid columns={3} gap="xs">
          {metrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} />
          ))}
          <FpsMetric value={framesPerSecond} averageValue={averageFramesPerSecond} samples={frameRateSamples} />
        </SimpleGrid>
      </Stack>
    </Box>
  );
};

import { Box, Button, HStack, Text } from "@chakra-ui/react";
import type { PerformanceSnapshot } from "@pstdio/sdk/extensions";
import { Gauge, TriangleAlert } from "lucide-react";
import { formatBytes, formatCpu, formatMs } from "../format";
import { type PerformanceHistory, performanceHistory } from "../performance-history";
import { useTranslations } from "../translations";
import { FrameRateBars, frameRateColor } from "./frame-rate-bars";
import { MetricBars } from "./metric-bars";

// The last 12 seconds of frame rate, as before, beside the last 12 seconds of backend replies.
const RECENT_SECONDS = 12;
const RECENT_SAMPLES = 6;

// The backend's recent replies, latest response time, CPU and memory.
const BackendReadout = (props: { history: PerformanceHistory }) => {
  const { history } = props;
  const { t } = useTranslations();
  const latest = history.response.at(-1);
  const backend = history.backend.at(-1);
  return (
    <HStack gap="xs" data-testid="performance-status-backend">
      <Box w="8">
        <MetricBars
          series={[
            history.response.map((point) => ({
              value: point.durationMs,
              flag: point.missed ? "warning" : undefined,
            })),
          ]}
          colors={["fg.subtle"]}
          count={RECENT_SAMPLES}
          height="performance-meter"
        />
      </Box>
      {history.connection === "reconnecting" ? (
        <Text textStyle="mono/XS" color="fg.warning" whiteSpace="nowrap">
          {t("popover.reconnecting", "Reconnecting")}
        </Text>
      ) : (
        <Text textStyle="mono/XS" whiteSpace="nowrap">
          {latest?.durationMs == null ? "– ms" : formatMs(latest.durationMs)}
        </Text>
      )}
      {backend?.cpuPercent == null ? null : (
        <Text textStyle="mono/XS" whiteSpace="nowrap">{`CPU ${formatCpu(backend.cpuPercent)}`}</Text>
      )}
      {backend?.memoryBytes == null ? null : (
        <Text textStyle="mono/XS" whiteSpace="nowrap">
          {formatBytes(backend.memoryBytes)}
        </Text>
      )}
    </HStack>
  );
};

interface PerformanceMeterProps {
  snapshot: PerformanceSnapshot;
}

// The trailing status bar meter. The host opens the details popover when it is clicked.
export const PerformanceMeter = (props: PerformanceMeterProps) => {
  const { snapshot } = props;
  const { t } = useTranslations();
  const current = snapshot.frameRate.at(-1);
  const sustained = snapshot.processes.find((process) => process.sustainedHighCpu);
  const history = performanceHistory(snapshot);

  return (
    // The host's status item owns focus and opening; the button only shows that the meter is clickable.
    <Button
      variant="ghost"
      size="2xs"
      tabIndex={-1}
      h="100dvh"
      gap="xs"
      color="fg.muted"
      data-testid="performance-status-item"
      aria-label={t("popover.statusLabel", "Frame rate {{fps}} fps. Show performance details.", {
        fps: current ?? "–",
      })}
    >
      {sustained || history.connection === "reconnecting" ? (
        <Box as="span" display="inline-flex" color="fg.warning">
          <TriangleAlert size={14} />
        </Box>
      ) : (
        <Gauge size={14} />
      )}
      <FrameRateBars
        buckets={snapshot.frameRate}
        count={RECENT_SECONDS}
        height="performance-meter"
        width="performance-bar"
        gap="performance-bar-gap"
      />
      <Text
        textStyle="mono/XS"
        color={frameRateColor(current)}
        data-testid="performance-status-fps"
        whiteSpace="nowrap"
      >
        {current === undefined ? "– fps" : `${current} fps`}
      </Text>
      {sustained ? (
        <Text textStyle="mono/XS" color="fg.warning" whiteSpace="nowrap">{`CPU ${sustained.averageCpuPercent}%`}</Text>
      ) : null}
      {history.connection === "unavailable" ? null : <BackendReadout history={history} />}
    </Button>
  );
};

// Shown while monitoring is off. Selecting it opens the details, where monitoring is switched on.
export const PerformanceMeterOff = () => {
  const { t } = useTranslations();
  return (
    <Button
      variant="ghost"
      size="2xs"
      tabIndex={-1}
      h="100dvh"
      gap="xs"
      color="fg.subtle"
      data-testid="performance-status-item"
      aria-label={t("meter.offLabel", "Performance monitoring is off. Show performance details.")}
    >
      <Gauge size={14} />
      <Text textStyle="mono/XS" whiteSpace="nowrap">
        {t("meter.off", "Off")}
      </Text>
    </Button>
  );
};

import "./performance-meter.css";
import type { PerformanceSnapshot } from "@pstdio/sdk/extensions";
import { Gauge, TriangleAlert } from "lucide-react";
import { formatBytes, formatCpu, formatMs } from "../format";
import { type PerformanceHistory, performanceHistory } from "../performance-history";
import { useTranslations } from "../translations";
import { FrameRateBars, frameRateColor } from "./frame-rate-bars";
import { MetricBars } from "./metric-bars";
import { performanceColor } from "./performance-color";

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
    <span className="performance-meter-backend" data-testid="performance-status-backend">
      <span className="performance-meter-response-bars">
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
      </span>
      {history.connection === "reconnecting" ? (
        <span className="performance-meter-warning">{t("popover.reconnecting", "Reconnecting")}</span>
      ) : (
        <span>{latest?.durationMs == null ? "– ms" : formatMs(latest.durationMs)}</span>
      )}
      {backend?.cpuPercent == null ? null : <span>{`CPU ${formatCpu(backend.cpuPercent)}`}</span>}
      {backend?.memoryBytes == null ? null : <span>{formatBytes(backend.memoryBytes)}</span>}
    </span>
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
    <button
      type="button"
      className="performance-meter"
      tabIndex={-1}
      data-testid="performance-status-item"
      aria-label={t("popover.statusLabel", "Frame rate {{fps}} fps. Show performance details.", {
        fps: current ?? "–",
      })}
    >
      {sustained || history.connection === "reconnecting" ? (
        <span className="performance-meter-warning">
          <TriangleAlert size={14} />
        </span>
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
      <span style={{ color: performanceColor(frameRateColor(current)) }} data-testid="performance-status-fps">
        {current === undefined ? "– fps" : `${current} fps`}
      </span>
      {sustained ? <span className="performance-meter-warning">{`CPU ${sustained.averageCpuPercent}%`}</span> : null}
      {history.connection === "unavailable" ? null : <BackendReadout history={history} />}
    </button>
  );
};

// Shown while monitoring is off. Selecting it opens the details, where monitoring is switched on.
export const PerformanceMeterOff = () => {
  const { t } = useTranslations();
  return (
    <button
      type="button"
      className="performance-meter"
      tabIndex={-1}
      data-monitoring="off"
      data-testid="performance-status-item"
      aria-label={t("meter.offLabel", "Performance monitoring is off. Show performance details.")}
    >
      <Gauge size={14} />
      <span>{t("meter.off", "Off")}</span>
    </button>
  );
};

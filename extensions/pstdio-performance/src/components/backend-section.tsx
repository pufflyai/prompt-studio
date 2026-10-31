import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { formatBytes, formatCpu, formatMs } from "../format";
import { HISTORY_SAMPLES, type MemoryKind, type PerformanceHistory, type ProcessPoint } from "../performance-history";
import { useTranslations } from "../translations";
import { type MetricBar, MetricBars } from "./metric-bars";
import { SectionLabel } from "./section-label";

const BACKEND_COLOR = "fg.muted";
const WORKBENCH_COLOR = "fg.subtle";

// A restart starts a new process, so its column is flagged instead of joined to the old line.
const processBars = (points: ProcessPoint[], value: (point: ProcessPoint) => number | null): MetricBar[] =>
  points.map((point) => ({ value: value(point), flag: point.restarted ? "warning" : undefined }));

interface ChartRowProps {
  title: string;
  value: React.ReactNode;
  children: React.ReactNode;
}

const ChartRow = (props: ChartRowProps) => {
  const { title, value, children } = props;
  return (
    <Stack gap="2xs">
      <HStack justifyContent="space-between" gap="sm">
        <Text textStyle="label/XS/medium" color="fg.muted">
          {title}
        </Text>
        <Text textStyle="mono/XS" color="fg.muted" truncate>
          {value}
        </Text>
      </HStack>
      {children}
    </Stack>
  );
};

const LegendDot = (props: { color: string; label: string }) => {
  const { color, label } = props;
  return (
    <HStack gap="2xs">
      <Box boxSize="status-dot" borderRadius="full" bg={color} />
      <Text textStyle="label/2XS" color="fg.subtle">
        {label}
      </Text>
    </HStack>
  );
};

interface BackendSectionProps {
  history: PerformanceHistory;
}

export const BackendSection = (props: BackendSectionProps) => {
  const { history } = props;
  const { t, plural } = useTranslations();
  const backend = history.backend.at(-1);
  const workbench = history.workbench.at(-1);
  const unavailable = t("popover.unavailable", "Unavailable");
  const memoryKinds: Record<MemoryKind, string> = {
    footprint: t("popover.memoryFootprint", "Physical footprint, including compressed memory"),
    private: t("popover.memoryPrivate", "Private memory"),
    resident: t("popover.memoryResident", "Resident memory, including shared pages"),
  };
  // A missing reading is left out, never shown as zero. The chart shows it as a flat line.
  const cpu = (point: ProcessPoint | undefined) => (point?.cpuPercent == null ? [] : [formatCpu(point.cpuPercent)]);
  const memory = (point: ProcessPoint | undefined) => {
    if (point?.memoryBytes == null) return [];
    const peak =
      point.peakMemoryBytes === null ? "" : ` (${t("popover.peak", "peak")} ${formatBytes(point.peakMemoryBytes)})`;
    return [`${formatBytes(point.memoryBytes)}${peak}`];
  };

  let response = t("popover.responseSummary", "avg {{avg}} · max {{max}}", {
    avg: history.responseSummary.averageMs === null ? "–" : formatMs(history.responseSummary.averageMs),
    max: history.responseSummary.maxMs === null ? "–" : formatMs(history.responseSummary.maxMs),
  });
  if (history.responseSummary.missed > 0)
    response += ` · ${plural("popover.missed", history.responseSummary.missed, "{{count}} missed", "{{count}} missed")}`;
  if (history.connection === "unavailable") response = unavailable;
  const backendName = history.remote ? t("popover.remoteBackend", "Remote backend") : t("popover.backend", "Backend");

  return (
    <Stack gap="xs" data-testid="performance-backend">
      <SectionLabel title={t("popover.backendTitle", "Backend")} detail={t("popover.window", "last 30 s")} />
      <ChartRow
        title={t("popover.responseTime", "Response time")}
        value={
          history.connection === "reconnecting" ? (
            <Text as="span" color="fg.warning">
              {t("popover.reconnecting", "Reconnecting")}
            </Text>
          ) : (
            response
          )
        }
      >
        <MetricBars
          series={[
            history.response.map((point) => ({
              value: point.durationMs,
              flag: point.missed ? "warning" : undefined,
            })),
          ]}
          colors={[BACKEND_COLOR]}
          count={HISTORY_SAMPLES}
          height="performance-chart"
        />
      </ChartRow>
      <HStack gap="sm">
        <LegendDot color={BACKEND_COLOR} label={backendName} />
        <LegendDot color={WORKBENCH_COLOR} label={t("popover.workbench", "Workbench")} />
      </HStack>
      <ChartRow title={t("popover.cpu", "CPU")} value={[...cpu(backend), ...cpu(workbench)].join(" · ")}>
        <MetricBars
          series={[
            processBars(history.backend, (point) => point.cpuPercent),
            processBars(history.workbench, (point) => point.cpuPercent),
          ]}
          colors={[BACKEND_COLOR, WORKBENCH_COLOR]}
          count={HISTORY_SAMPLES}
          height="performance-chart"
        />
      </ChartRow>
      <ChartRow
        title={t("popover.memory", "Memory")}
        value={
          <Tooltip
            content={[backend, workbench]
              .flatMap((point) => (point?.memoryKind ? [memoryKinds[point.memoryKind]] : []))
              .join(" · ")}
          >
            <Text as="span">{[...memory(backend), ...memory(workbench)].join(" · ")}</Text>
          </Tooltip>
        }
      >
        <MetricBars
          series={[
            processBars(history.backend, (point) => point.memoryBytes),
            processBars(history.workbench, (point) => point.memoryBytes),
          ]}
          colors={[BACKEND_COLOR, WORKBENCH_COLOR]}
          count={HISTORY_SAMPLES}
          height="performance-chart"
        />
      </ChartRow>
    </Stack>
  );
};

import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, CopyButton, toaster } from "@pstdio/ui";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useProjectExtensions } from "@/shared/extensions/use-project-extensions";
import type { PerformanceMonitoringController } from "../performance-monitoring-controller";
import { ProcessRows, SectionHeading, SlowFrameRows } from "./performance-rows";

const SNAPSHOT_POLL_MS = 2_000;
const performanceSnapshotQueryKey = ["performance-snapshot"] as const;

const seconds = (milliseconds: number) => (milliseconds / 1000).toFixed(1);

interface PerformanceViewContentProps {
  snapshot?: PerformanceSnapshot | null;
  error?: string;
  extensionName: (installedExtensionId: string) => string;
}

const FramesNote = (props: { snapshot: PerformanceSnapshot }) => {
  const { snapshot } = props;
  const { t } = useTranslation("settings");
  const source = snapshot.capabilities.slowFrames;
  let note: string | null = null;
  if (source === "longtask") note = t("performance.view.longTasksOnly");
  if (snapshot.frames.length === 0) note = t("performance.view.noSlowFrames");
  if (source === "unsupported") note = t("performance.view.framesUnsupported");
  if (!note) return null;
  return (
    <Text textStyle="label/S/regular" color="fg.muted" paddingX="xs">
      {note}
    </Text>
  );
};

interface ProcessSectionProps {
  snapshot: PerformanceSnapshot;
  extensionName: (installedExtensionId: string) => string;
}

const ProcessSection = (props: ProcessSectionProps) => {
  const { snapshot, extensionName } = props;
  const { t } = useTranslation("settings");
  if (!snapshot.capabilities.processMetrics) {
    return (
      <AlertMessage status="info" title={t("performance.view.browserTitle")}>
        {t("performance.view.browserBody")}
      </AlertMessage>
    );
  }
  return (
    <>
      <SectionHeading title={t("performance.view.processes")} caption={t("performance.view.processesCaption")} />
      {snapshot.measurementWindowMs === null ? (
        <Text textStyle="label/S/regular" color="fg.muted" paddingX="xs">
          {t("performance.view.waiting")}
        </Text>
      ) : (
        <ProcessRows processes={snapshot.processes} extensionName={extensionName} />
      )}
    </>
  );
};

export const PerformanceViewContent = (props: PerformanceViewContentProps) => {
  const { snapshot, error, extensionName } = props;
  const { t } = useTranslation("settings");
  const [dismissed, setDismissed] = useState<number[]>([]);

  if (error)
    return (
      <AlertMessage status="error" title={t("performance.view.loadError")}>
        {error}
      </AlertMessage>
    );
  if (!snapshot) return <Spinner size="sm" margin="md" />;

  const sustained = snapshot.processes.filter(
    (process) => process.sustainedHighCpu && !dismissed.includes(process.pid),
  );
  const label = (process: PerformanceSnapshot["processes"][number]) =>
    process.name ?? t(`performance.view.roles.${process.role}`);

  return (
    <Stack gap="xs" paddingX="xs" paddingY="sm">
      <HStack justifyContent="space-between" paddingLeft="xs">
        <Text textStyle="label/S/regular" color="fg.subtle">
          {snapshot.sampleIntervalMs !== null && snapshot.measurementWindowMs !== null
            ? t("performance.view.window", {
                interval: seconds(snapshot.sampleIntervalMs),
                window: seconds(snapshot.measurementWindowMs),
              })
            : null}
        </Text>
        <CopyButton
          size="2xs"
          label={t("performance.view.copy")}
          text={JSON.stringify(snapshot, null, 2)}
          onCopyError={() => toaster.create({ type: "error", title: t("performance.view.copyError") })}
        />
      </HStack>
      {sustained.map((process) => (
        <AlertMessage
          key={process.pid}
          status="warning"
          title={t("performance.view.sustainedTitle")}
          onClose={() => setDismissed((current) => [...current, process.pid])}
        >
          {t("performance.view.sustainedBody", {
            process: label(process),
            cpu: `${process.averageCpuPercent}%`,
            seconds: (snapshot.warning?.windowMs ?? 0) / 1000,
          })}
        </AlertMessage>
      ))}
      <ProcessSection snapshot={snapshot} extensionName={extensionName} />
      <SectionHeading title={t("performance.view.slowFrames")} caption={t("performance.view.slowFramesCaption")} />
      <SlowFrameRows frames={snapshot.frames} />
      <FramesNote snapshot={snapshot} />
    </Stack>
  );
};

interface PerformanceViewProps {
  controller: PerformanceMonitoringController;
  projectId?: string;
}

// Reads the existing collector. Closing the view stops polling; collection itself
// continues until monitoring is turned off.
export const PerformanceView = (props: PerformanceViewProps) => {
  const { controller, projectId } = props;
  const { t } = useTranslation("settings");
  const enabled = useSyncExternalStore(controller.subscribe, controller.getEnabled);
  const snapshot = useQuery({
    queryKey: performanceSnapshotQueryKey,
    queryFn: () => controller.host.snapshot(),
    enabled: enabled === true,
    refetchInterval: SNAPSHOT_POLL_MS,
    gcTime: 0,
  });
  const extensions = useProjectExtensions(projectId);
  const extensionName = (installedExtensionId: string) =>
    extensions.data?.extensions.find((extension) => extension.installedExtensionId === installedExtensionId)
      ?.displayName ?? t("performance.view.unknownExtension");

  return (
    <PerformanceViewContent
      snapshot={enabled ? snapshot.data : undefined}
      error={snapshot.error?.message}
      extensionName={extensionName}
    />
  );
};

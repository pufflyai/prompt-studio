import { Box, Button, HStack, Popover, Portal, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useQuery } from "@tanstack/react-query";
import { Gauge, TriangleAlert } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useOpenExtensionViews } from "@/shared/extensions/open-extension-views";
import { pausedExtensions, usePausedExtensions } from "@/shared/extensions/paused-extensions";
import { useProjectExtensions } from "@/shared/extensions/use-project-extensions";
import type { PerformanceMonitoringController } from "../performance-monitoring-controller";
import { FrameRateBars, frameRateColor } from "./frame-rate-bars";
import { PerformancePopoverContent } from "./performance-popover-content";

const SNAPSHOT_POLL_MS = 2_000;
const performanceSnapshotQueryKey = ["performance-snapshot"] as const;

interface PerformanceStatusItemProps {
  controller: PerformanceMonitoringController;
  projectId?: string;
}

// The trailing status bar meter: the last 12 seconds of frame rate and the
// current fps. It exists only while monitoring is on and opens the popover.
export const PerformanceStatusItem = (props: PerformanceStatusItemProps) => {
  const { controller, projectId } = props;
  const { t } = useTranslation("settings");
  const buckets = useSyncExternalStore(controller.frameRate.subscribe, controller.frameRate.getBuckets);
  const open = useSyncExternalStore(controller.subscribe, controller.getPopoverOpen);
  const paused = usePausedExtensions();
  const openViews = useOpenExtensionViews();
  const snapshot = useQuery({
    queryKey: performanceSnapshotQueryKey,
    queryFn: () => controller.host.snapshot(),
    refetchInterval: SNAPSHOT_POLL_MS,
    gcTime: 0,
  });
  const extensions = useProjectExtensions(projectId);
  const extensionName = (installedExtensionId: string) =>
    extensions.data?.extensions.find((extension) => extension.installedExtensionId === installedExtensionId)
      ?.displayName ?? t("performance.popover.unknownExtension");

  const current = buckets.at(-1);
  const sustained = snapshot.data?.processes.find((process) => process.sustainedHighCpu);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(event) => controller.setPopoverOpen(event.open)}
      positioning={{ placement: "top-end", offset: { mainAxis: 4 } }}
    >
      <Tooltip content={t("performance.popover.statusLabel", { fps: current ?? "–" })} openDelay={300} disabled={open}>
        <Popover.Trigger asChild>
          <Button
            variant="ghost"
            size="2xs"
            gap="xs"
            aria-label={t("performance.popover.statusLabel", { fps: current ?? "–" })}
            data-testid="performance-status-item"
          >
            <HStack gap="xs">
              {sustained ? (
                <Box as="span" display="inline-flex" color="fg.warning">
                  <TriangleAlert />
                </Box>
              ) : (
                <Gauge />
              )}
              <FrameRateBars
                buckets={buckets}
                count={12}
                height="performance-meter"
                width="performance-bar"
                gap="performance-bar-gap"
              />
              <Text textStyle="mono/XS" color={frameRateColor(current)} data-testid="performance-status-fps">
                {current === undefined ? "– fps" : `${current} fps`}
              </Text>
              {sustained ? (
                <Text textStyle="mono/XS" color="fg.warning">{`CPU ${sustained.averageCpuPercent}%`}</Text>
              ) : null}
            </HStack>
          </Button>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="performance-popover" maxH="70vh" overflowY="auto">
            <Popover.Body paddingX="md" paddingY="sm">
              <PerformancePopoverContent
                snapshot={snapshot.data}
                error={snapshot.error?.message}
                buckets={buckets}
                paused={paused}
                openViews={openViews}
                extensionName={extensionName}
                onPause={pausedExtensions.pause}
                onResume={pausedExtensions.resume}
              />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

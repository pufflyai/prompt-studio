import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { Gauge } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CpuSection, type CpuSectionProps } from "./cpu-section";
import { FrameRateBars, frameRateColor } from "./frame-rate-bars";

interface FrameRateSectionProps {
  buckets: number[];
}

const FrameRateSection = (props: FrameRateSectionProps) => {
  const { buckets } = props;
  const { t } = useTranslation("settings");
  const current = buckets.at(-1);
  const average = buckets.length > 0 ? Math.round(buckets.reduce((sum, fps) => sum + fps, 0) / buckets.length) : null;
  const minimum = buckets.length > 0 ? Math.min(...buckets) : null;
  return (
    <Stack gap="2xs">
      <HStack alignItems="end" gap="2xs">
        <Text
          textStyle="mono/3XL/semibold"
          // The readout is the popover's headline, so a smooth rate keeps full contrast.
          color={current !== undefined && current >= 50 ? "fg" : frameRateColor(current)}
        >
          {current ?? "–"}
        </Text>
        <Text textStyle="label/S/regular" color="fg.muted">
          fps
        </Text>
        <Text textStyle="mono/XS" color="fg.muted" marginLeft="auto">
          {t("performance.popover.avgMin", { avg: average ?? "–", min: minimum ?? "–" })}
        </Text>
      </HStack>
      <FrameRateBars buckets={buckets} count={30} height="performance-chart" width="auto" gap="3xs" />
      <HStack justifyContent="space-between">
        <Text textStyle="label/2XS" color="fg.subtle">
          {t("performance.popover.ago")}
        </Text>
        <Text textStyle="label/2XS" color="fg.subtle">
          {t("performance.popover.now")}
        </Text>
      </HStack>
    </Stack>
  );
};

export interface PerformancePopoverContentProps extends CpuSectionProps {
  buckets: number[];
}

export const PerformancePopoverContent = (props: PerformancePopoverContentProps) => {
  const { buckets, ...cpu } = props;
  const { snapshot, extensionName } = cpu;
  const { t } = useTranslation("settings");
  const sustained = snapshot?.processes.find((process) => process.sustainedHighCpu);
  // Any process can stay busy, including the GPU and other helpers.
  const sustainedName = () => {
    if (!sustained) return "";
    if (sustained.role === "workbench") return t("performance.popover.workbench");
    if (sustained.extensionFrames.length > 0)
      return [...new Set(sustained.extensionFrames.map((frame) => extensionName(frame.installedExtensionId)))].join(
        ", ",
      );
    return sustained.name ?? t(`performance.popover.roles.${sustained.role}`);
  };

  return (
    <Stack gap="sm" data-testid="performance-popover">
      <HStack gap="xs">
        <Gauge size={14} />
        <Text textStyle="label/M/medium">{t("performance.popover.title")}</Text>
      </HStack>
      <FrameRateSection buckets={buckets} />
      {sustained ? (
        <AlertMessage status="warning" title={t("performance.popover.sustainedTitle")}>
          {t("performance.popover.sustainedBody", {
            process: sustainedName(),
            cpu: `${sustained.averageCpuPercent}%`,
            seconds: (snapshot?.warning?.windowMs ?? 0) / 1000,
          })}
        </AlertMessage>
      ) : null}
      <Box borderTopWidth="1px" borderColor="border.subtle" />
      <CpuSection {...cpu} />
    </Stack>
  );
};

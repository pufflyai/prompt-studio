import { Box, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, Tooltip } from "@pstdio/ui";
import { Check, Copy, Gauge } from "lucide-react";
import { extensionName } from "../cpu-sources";
import { performanceHistory } from "../performance-history";
import { useTranslations } from "../translations";
import { BackendSection } from "./backend-section";
import { CpuSection, type CpuSectionProps } from "./cpu-section";
import { FrameRateBars, frameRateColor } from "./frame-rate-bars";

// Electron names only utility processes, so the others need a readable role.
const ROLE_LABELS: Record<string, string> = {
  main: "App",
  gpu: "GPU",
  utility: "Utility process",
  workbench: "Workbench",
  startup: "Startup window",
  "extension-frames": "Extension frames",
  renderer: "Renderer",
  other: "Other process",
};

interface FrameRateSectionProps {
  buckets: number[];
}

const FrameRateSection = (props: FrameRateSectionProps) => {
  const { buckets } = props;
  const { t } = useTranslations();
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
          {t("popover.avgMin", "avg {{avg}} · min {{min}}", { avg: average ?? "–", min: minimum ?? "–" })}
        </Text>
      </HStack>
      <FrameRateBars buckets={buckets} count={30} height="performance-chart" width="auto" gap="3xs" />
      <HStack justifyContent="space-between">
        <Text textStyle="label/2XS" color="fg.subtle">
          {t("popover.ago", "30 s ago")}
        </Text>
        <Text textStyle="label/2XS" color="fg.subtle">
          {t("popover.now", "now")}
        </Text>
      </HStack>
    </Stack>
  );
};

export interface PerformancePopoverContentProps extends CpuSectionProps {
  copied?: boolean;
  // A failed copy, pause or resume, shown below the header that started it.
  actionError?: string;
  onCopy: () => void;
  onDismissActionError: () => void;
}

export const PerformancePopoverContent = (props: PerformancePopoverContentProps) => {
  const { copied, actionError, onCopy, onDismissActionError, ...cpu } = props;
  const { snapshot } = cpu;
  const { t } = useTranslations();
  const buckets = snapshot?.frameRate ?? [];
  const sustained = snapshot?.processes.find((process) => process.sustainedHighCpu);
  // Any process can stay busy, including the GPU and other helpers.
  const sustainedName = () => {
    if (!sustained) return "";
    if (sustained.role === "workbench") return t("popover.workbench", "Workbench");
    if (sustained.extensionFrames.length > 0)
      return [...new Set(sustained.extensionFrames.map((frame) => extensionName(frame.webviewId)))].join(", ");
    return sustained.name ?? t(`popover.roles.${sustained.role}`, ROLE_LABELS[sustained.role] ?? sustained.role);
  };
  const copyLabel = copied
    ? t("popover.copied", "Performance snapshot copied")
    : t("popover.copy", "Copy performance snapshot");

  return (
    <Stack gap="0" data-testid="performance-popover">
      {/* The details webview scrolls itself; its header stays in place above the measurements. */}
      <HStack gap="xs" position="sticky" top="0" zIndex="1" bg="bg" paddingX="md" paddingY="sm">
        <Gauge size={14} />
        <Text textStyle="label/M/medium">{t("popover.title", "Performance")}</Text>
        <Tooltip content={copyLabel}>
          <IconButton size="2xs" variant="ghost" marginLeft="auto" aria-label={copyLabel} onClick={onCopy}>
            {copied ? <Check /> : <Copy />}
          </IconButton>
        </Tooltip>
      </HStack>
      <Stack gap="sm" paddingX="md" paddingBottom="sm">
        {actionError ? <AlertMessage status="error" title={actionError} onClose={onDismissActionError} /> : null}
        <FrameRateSection buckets={buckets} />
        {sustained ? (
          <AlertMessage status="warning" title={t("popover.sustainedTitle", "Sustained high CPU")}>
            {t("popover.sustainedBody", "{{process}} averaged {{cpu}} CPU over the last {{seconds}} seconds.", {
              process: sustainedName(),
              cpu: `${sustained.averageCpuPercent}%`,
              seconds: (snapshot?.warning?.windowMs ?? 0) / 1000,
            })}
          </AlertMessage>
        ) : null}
        {snapshot?.version === 2 ? (
          <>
            <Box borderTopWidth="1px" borderColor="border.subtle" />
            <BackendSection history={performanceHistory(snapshot)} />
          </>
        ) : null}
        <Box borderTopWidth="1px" borderColor="border.subtle" />
        <CpuSection {...cpu} />
      </Stack>
    </Stack>
  );
};

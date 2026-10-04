import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, Tooltip } from "@pstdio/ui";
import { AppWindow, ChevronDown, ChevronUp, Pause, Play, Puzzle } from "lucide-react";
import type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type CpuSource, cpuSources, foldSources, keepOrder, SHOWN_EXTENSIONS } from "../cpu-sources";
import { SectionLabel } from "./section-label";

// A row turns amber when its 30-second average reaches a quarter of one core.
const BUSY_CPU_PERCENT = 25;

// Electron reports memory in kibibytes; people read decimal megabytes.
const formatMemory = (kibibytes: number) => `${Math.round((kibibytes * 1024) / 1_000_000)} MB`;
const formatCpu = (percent: number) =>
  `${percent < 10 ? percent.toFixed(1).replace(/\.0$/, "") : Math.round(percent)}%`;

interface CpuRowProps {
  name: string;
  detail: string;
  cpuPercent: number | null;
  icon: "workbench" | "extension";
  paused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

const CpuRow = (props: CpuRowProps) => {
  const { name, detail, cpuPercent, icon, paused, onPause, onResume } = props;
  const { t } = useTranslation("settings");
  const busy = cpuPercent !== null && cpuPercent >= BUSY_CPU_PERCENT;
  return (
    <HStack gap="xs" paddingY="2xs" data-testid="performance-cpu-row" data-name={name}>
      <Box
        bg="bg.muted"
        borderRadius="xs"
        boxSize="5"
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="fg.muted"
        opacity={paused ? 0.5 : 1}
        flexShrink={0}
      >
        {icon === "workbench" ? <AppWindow size={12} /> : <Puzzle size={12} />}
      </Box>
      <Stack gap="0" flex="1" minW="0">
        <Text textStyle="label/S/regular" color={paused ? "fg.muted" : undefined} truncate>
          {name}
        </Text>
        <Text textStyle="label/2XS" color="fg.subtle" truncate>
          {detail}
        </Text>
      </Stack>
      {cpuPercent !== null ? (
        <Text textStyle="mono/XS" color={busy ? "fg.warning" : "fg.muted"} data-testid="performance-cpu-value">
          {formatCpu(cpuPercent)}
        </Text>
      ) : null}
      {paused && onResume ? (
        <Button
          size="2xs"
          variant="outline"
          aria-label={t("performance.popover.resumeLabel", { name })}
          onClick={onResume}
        >
          <Play />
          {t("performance.popover.resume")}
        </Button>
      ) : null}
      {!paused && onPause ? (
        <Tooltip content={t("performance.popover.pauseTooltip", { name })}>
          <IconButton
            size="2xs"
            variant="ghost"
            aria-label={t("performance.popover.pause", { name })}
            onClick={onPause}
          >
            <Pause />
          </IconButton>
        </Tooltip>
      ) : null}
      {!onPause && !onResume ? <Box boxSize="6" flexShrink={0} /> : null}
    </HStack>
  );
};

export interface CpuSectionProps {
  snapshot?: PerformanceSnapshot | null;
  error?: string;
  paused: ReadonlySet<string>;
  openViews: ReadonlyMap<string, number>;
  extensionName: (installedExtensionId: string) => string;
  onPause: (installedExtensionId: string) => void;
  onResume: (installedExtensionId: string) => void;
}

export const CpuSection = (props: CpuSectionProps) => {
  const { snapshot, error, paused, openViews, extensionName, onPause, onResume } = props;
  const { t } = useTranslation("settings");
  const [expanded, setExpanded] = useState(false);
  const processMetrics = snapshot?.capabilities.processMetrics === true;
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const sources = cpuSources(snapshot, paused, openViews);
  const ordered = keepOrder(sources.extensions, frozenOrder);
  const folded = foldSources(ordered, expanded);
  // Pausing moves a row and new samples re-sort the list; neither may happen under the cursor.
  const freeze = () => setFrozenOrder((order) => order ?? ordered.map((source) => source.key));
  const detail = (source: CpuSource) => {
    if (source.paused) return t("performance.popover.paused");
    const views = t("performance.popover.views", { count: source.views });
    return source.memoryKiB === null ? views : `${views} · ${formatMemory(source.memoryKiB)}`;
  };

  return (
    <Stack
      gap="0"
      onPointerEnter={freeze}
      onPointerLeave={() => setFrozenOrder(null)}
      onFocus={freeze}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFrozenOrder(null);
      }}
    >
      <SectionLabel
        title={t("performance.popover.cpu")}
        detail={processMetrics ? t("performance.popover.window") : undefined}
      />
      {error ? (
        <AlertMessage status="error" title={t("performance.popover.cpuUnavailableTitle")}>
          {t("performance.popover.cpuUnavailableBody")}
        </AlertMessage>
      ) : null}
      {snapshot && !processMetrics ? (
        <AlertMessage status="info" title={t("performance.popover.browserTitle")}>
          {t("performance.popover.browserBody")}
        </AlertMessage>
      ) : null}
      {sources.workbench ? (
        <CpuRow
          name={t("performance.popover.workbench")}
          detail={t("performance.popover.workbenchDetail")}
          cpuPercent={sources.workbench.cpuPercent}
          icon="workbench"
        />
      ) : null}
      {folded.shown.map((source) => {
        // An extension has its own process, so a row with one extension can pause it.
        const [installedExtensionId] = source.installedExtensionIds;
        const single = source.installedExtensionIds.length === 1 ? installedExtensionId : undefined;
        return (
          <CpuRow
            key={source.key}
            name={source.installedExtensionIds.map(extensionName).join(", ")}
            detail={detail(source)}
            cpuPercent={source.paused ? null : source.cpuPercent}
            icon="extension"
            paused={source.paused}
            onPause={single ? () => onPause(single) : undefined}
            onResume={single ? () => onResume(single) : undefined}
          />
        );
      })}
      {sources.extensions.length > SHOWN_EXTENSIONS ? (
        <Button
          size="2xs"
          variant="ghost"
          justifyContent="start"
          paddingX="0"
          onClick={() => setExpanded((open) => !open)}
          data-testid="performance-more-extensions"
        >
          {expanded ? <ChevronUp /> : <ChevronDown />}
          {expanded
            ? t("performance.popover.fewer", { count: SHOWN_EXTENSIONS })
            : t("performance.popover.more", { count: folded.hidden })}
          {expanded ? null : (
            <Text as="span" textStyle="mono/XS" color="fg.muted" marginLeft="auto">
              {formatCpu(folded.hiddenCpuPercent)}
            </Text>
          )}
        </Button>
      ) : null}
    </Stack>
  );
};

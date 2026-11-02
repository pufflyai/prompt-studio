import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { PerformanceSnapshot } from "@pstdio/sdk/extensions";
import { AlertMessage, Tooltip } from "@pstdio/ui";
import { AppWindow, ChevronDown, ChevronUp, Layers, Pause, Play, Puzzle } from "lucide-react";
import { useEffect, useState } from "react";
import { type CpuSource, cpuSources, foldSources, keepOrder, SHOWN_EXTENSIONS } from "../cpu-sources";
import { formatBytes, formatCpu } from "../format";
import { useTranslations } from "../translations";
import { SectionLabel } from "./section-label";

const OWN_EXTENSION_ID = "pstdio.pstdio-performance";

// A row turns amber when its 30-second average reaches a quarter of one core.
const BUSY_CPU_PERCENT = 25;

const RowIcon = (props: { icon: "workbench" | "extension" | "shared" }) => {
  const { icon } = props;
  if (icon === "workbench") return <AppWindow size={12} />;
  if (icon === "shared") return <Layers size={12} />;
  return <Puzzle size={12} />;
};

interface CpuRowProps {
  // The row's identity across running and paused states, which can change its name.
  rowKey: string;
  name: string;
  detail: string;
  cpuPercent: number | null;
  icon: "workbench" | "extension" | "shared";
  paused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

const CpuRow = (props: CpuRowProps) => {
  const { rowKey, name, detail, cpuPercent, icon, paused, onPause, onResume } = props;
  const { t } = useTranslations();
  const busy = cpuPercent !== null && cpuPercent >= BUSY_CPU_PERCENT;
  return (
    <HStack gap="xs" paddingY="2xs" data-testid="performance-cpu-row" data-key={rowKey}>
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
        <RowIcon icon={icon} />
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
          aria-label={t("popover.resumeLabel", "Resume {{name}}", { name })}
          onClick={onResume}
        >
          <Play />
          {t("popover.resume", "Resume")}
        </Button>
      ) : null}
      {!paused && onPause ? (
        <Tooltip content={t("popover.pauseTooltip", "Pause {{name}} · unloads its views", { name })}>
          <IconButton
            size="2xs"
            variant="ghost"
            aria-label={t("popover.pause", "Pause {{name}}", { name })}
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
  onPause: (installedExtensionId: string) => void;
  onResume: (installedExtensionId: string) => void;
}

export const CpuSection = (props: CpuSectionProps) => {
  const { snapshot, error, onPause, onResume } = props;
  const { t, plural } = useTranslations();
  const [expanded, setExpanded] = useState(false);
  const processMetrics = snapshot?.capabilities.processMetrics === true;
  const [frozenOrder, setFrozenOrder] = useState<string[] | null>(null);
  const [previous, setPrevious] = useState(() => ({ snapshot, extensions: cpuSources(snapshot).extensions }));
  const sources = cpuSources(snapshot, previous.extensions);
  if (previous.snapshot !== snapshot) setPrevious({ snapshot, extensions: sources.extensions });
  const ordered = keepOrder(sources.extensions, frozenOrder);
  const folded = foldSources(ordered, expanded);
  // Pausing moves a row and new samples re-sort the list; neither may happen under the cursor.
  const freeze = () => setFrozenOrder((order) => order ?? ordered.map((source) => source.key));
  // The public snapshot names an extension only by its install id, so a row names the views it hosts.
  // A paused extension has no views left to name it by, so keep the name it had while running.
  const [knownNames, setKnownNames] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    const named = sources.extensions.filter((source) => source.installedExtensionId && source.name);
    if (named.every((source) => knownNames.get(source.key) === source.name)) return;
    setKnownNames(new Map([...knownNames, ...named.map((source) => [source.key, source.name] as const)]));
  }, [sources.extensions, knownNames]);
  const name = (source: CpuSource) => {
    if (source.kind === "shared") return t("popover.sharedProcess", "Shared extension process");
    return source.name || knownNames.get(source.key) || t("popover.pausedExtension", "Paused extension");
  };
  const detail = (source: CpuSource) => {
    if (source.resuming) return t("popover.resuming", "Resuming · waiting for a process sample");
    if (source.paused) return t("popover.paused", "Paused · views unloaded");
    const views = plural("popover.views", source.views, "{{count}} view", "{{count}} views");
    if (source.cpuPercent === null) return `${views} · ${t("popover.inSharedProcess", "in the shared process")}`;
    // Electron reports memory in kibibytes.
    return source.memoryKiB === null ? views : `${views} · ${formatBytes(source.memoryKiB * 1024)}`;
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
        title={t("popover.cpu", "CPU")}
        detail={processMetrics ? t("popover.window", "last 30 s") : undefined}
      />
      {error ? (
        <AlertMessage status="error" title={t("popover.cpuUnavailableTitle", "Could not read CPU.")}>
          {t("popover.cpuUnavailableBody", "Frame rate still updates.")}
        </AlertMessage>
      ) : null}
      {snapshot && !processMetrics ? (
        <AlertMessage status="info" title={t("popover.browserTitle", "CPU is measured in the desktop app")}>
          {t("popover.browserBody", "A browser tab cannot read CPU.")}
        </AlertMessage>
      ) : null}
      {sources.workbench ? (
        <CpuRow
          rowKey="workbench"
          name={t("popover.workbench", "Workbench")}
          detail={t("popover.workbenchDetail", "This window")}
          cpuPercent={sources.workbench.cpuPercent}
          icon="workbench"
        />
      ) : null}
      {folded.shown.map((source) => {
        // Pausing this extension would unload the details you are reading.
        const pausable = source.installedExtensionId && source.extensionId !== OWN_EXTENSION_ID;
        const installedExtensionId = pausable ? source.installedExtensionId : undefined;
        return (
          <CpuRow
            key={source.key}
            rowKey={source.key}
            name={name(source)}
            detail={detail(source)}
            cpuPercent={source.paused ? null : source.cpuPercent}
            icon={source.kind === "shared" ? "shared" : "extension"}
            paused={source.paused}
            onPause={installedExtensionId ? () => onPause(installedExtensionId) : undefined}
            onResume={installedExtensionId ? () => onResume(installedExtensionId) : undefined}
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
            ? t("popover.fewer", "Show the {{count}} busiest", { count: SHOWN_EXTENSIONS })
            : plural("popover.more", folded.hidden, "{{count}} more extension", "{{count}} more extensions")}
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

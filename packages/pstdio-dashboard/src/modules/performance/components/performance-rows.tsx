import { Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { AppWindow, Box, Cpu, Monitor, Network, PanelTop, Puzzle, Timer } from "lucide-react";
import type {
  PerformanceProcess,
  PerformanceProcessRole,
  SlowFrame,
} from "pstdio-api-contracts/performance-diagnostics";
import { useTranslation } from "react-i18next";

const roleIcons: Record<PerformanceProcessRole, typeof Cpu> = {
  main: Box,
  gpu: Monitor,
  utility: Network,
  workbench: AppWindow,
  startup: PanelTop,
  "extension-frames": Puzzle,
  renderer: Cpu,
  other: Cpu,
};

const RoleIcon = (props: { role: PerformanceProcessRole }) => {
  const { role } = props;
  const Icon = roleIcons[role];
  return <Icon />;
};

// Electron reports memory in kibibytes; people read decimal megabytes.
const formatMemory = (kibibytes: number) => `${Math.round((kibibytes * 1024) / 1_000_000)} MB`;

const Value = (props: { children: string }) => {
  const { children } = props;
  return (
    <Text textStyle="mono/XS" color="fg.muted" whiteSpace="nowrap">
      {children}
    </Text>
  );
};

interface SectionHeadingProps {
  title: string;
  caption?: string;
}

export const SectionHeading = (props: SectionHeadingProps) => {
  const { title, caption } = props;
  return (
    <Stack gap="3xs" paddingX="xs" paddingTop="2xs">
      <Text textStyle="label/XS/caps" color="fg.subtle">
        {title}
      </Text>
      {caption ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          {caption}
        </Text>
      ) : null}
    </Stack>
  );
};

interface ProcessRowsProps {
  processes: PerformanceProcess[];
  extensionName: (installedExtensionId: string) => string;
}

export const ProcessRows = (props: ProcessRowsProps) => {
  const { processes, extensionName } = props;
  const { t, i18n } = useTranslation("settings");
  const list = new Intl.ListFormat(i18n.language, { type: "conjunction" });
  const describe = (process: PerformanceProcess) => {
    const names = [...new Set(process.extensionFrames.map((frame) => extensionName(frame.installedExtensionId)))];
    if (names.length > 1) return t("performance.view.sharedBy", { names: list.format(names) });
    if (names.length === 1) return names[0];
    return t(`performance.view.roleDescriptions.${process.role}`, { defaultValue: "" }) || undefined;
  };
  return (
    <Stack gap="0">
      {processes.map((process) => (
        <ListRow
          key={process.pid}
          id={`process-${process.pid}`}
          label={process.name ?? t(`performance.view.roles.${process.role}`)}
          description={describe(process)}
          icon={<RoleIcon role={process.role} />}
          endContent={<Value>{`${process.cpuPercent}% · ${formatMemory(process.memoryKiB.workingSet)}`}</Value>}
        />
      ))}
    </Stack>
  );
};

export const SlowFrameRows = (props: { frames: SlowFrame[] }) => {
  const { frames } = props;
  const { t } = useTranslation("settings");
  return (
    <Stack gap="0">
      {frames.map((frame, index) => {
        const script = frame.scripts[0];
        return (
          <ListRow
            key={`${frame.startedAt}-${index}`}
            id={`frame-${index}`}
            label={script?.invoker ?? t("performance.view.unknownScript")}
            description={
              script
                ? t("performance.view.frameScript", {
                    source: script.source ?? script.invokerType,
                    duration: script.durationMs,
                  })
                : new Date(frame.startedAt).toLocaleTimeString()
            }
            icon={<Timer />}
            endContent={<Value>{`${frame.durationMs} ms`}</Value>}
          />
        );
      })}
    </Stack>
  );
};

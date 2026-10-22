import { Grid, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { EmptyState, SegmentedControl } from "@pstdio/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { TrendMetric } from "../benchmarks/analysis";
import { PageFrame } from "../webview/page-frame";
import { PlatformControl } from "../webview/platform-control";
import { MetricCard } from "./metric-card";
import { SelectedMetric } from "./selected-metric";
import { SummaryTiles } from "./summary-tiles";
import { groupBySuite, metricId, versionSummary } from "./trend-summary";
import { VersionSnapshot } from "./version-snapshot";

export type TrendsMode = "versions" | "version";

export interface TrendsViewProps {
  versions: string[];
  metrics: TrendMetric[];
  platform: string;
  mode: TrendsMode;
  versionIndex: number;
  selected?: string;
  status?: ReactNode;
  onPlatformChange: (platform: string) => void;
  onModeChange: (mode: TrendsMode) => void;
  onVersionChange: (index: number) => void;
  onSelect: (metric: string) => void;
}

interface VersionStepperProps {
  versions: string[];
  index: number;
  onChange: (index: number) => void;
}

const VersionStepper = (props: VersionStepperProps) => {
  const { versions, index, onChange } = props;
  return (
    <HStack gap="2xs" role="group" aria-label="Version">
      <IconButton
        size="xs"
        variant="ghost"
        aria-label="Previous version"
        disabled={index <= 0}
        onClick={() => onChange(index - 1)}
      >
        <ChevronLeft />
      </IconButton>
      <Text textStyle="mono/XS" minW="16" textAlign="center">
        {versions[index]}
      </Text>
      <IconButton
        size="xs"
        variant="ghost"
        aria-label="Next version"
        disabled={index >= versions.length - 1}
        onClick={() => onChange(index + 1)}
      >
        <ChevronRight />
      </IconButton>
    </HStack>
  );
};

export const TrendsView = (props: TrendsViewProps) => {
  const { versions, metrics, platform, mode, versionIndex, selected, status } = props;
  const index = mode === "versions" ? versions.length - 1 : versionIndex;
  const selectedMetric = metrics.find((metric) => metricId(metric) === selected) ?? metrics[0];
  const toolbar = (
    <>
      <SegmentedControl
        aria-label="View"
        value={mode}
        onValueChange={(value) => props.onModeChange(value as TrendsMode)}
        options={[
          { value: "versions", label: "Across versions" },
          { value: "version", label: "One version" },
        ]}
      />
      {mode === "version" && versions.length ? (
        <VersionStepper versions={versions} index={versionIndex} onChange={props.onVersionChange} />
      ) : null}
      <HStack flex="1" justify="flex-end" gap="sm" minW="0">
        {status}
        <PlatformControl value={platform} onValueChange={props.onPlatformChange} />
      </HStack>
    </>
  );
  if (!versions.length)
    return (
      <PageFrame toolbar={toolbar}>
        <EmptyState
          title="No release results yet"
          description="Releases attach their benchmark results when they publish. Results appear here after the first release that records them."
        />
      </PageFrame>
    );
  return (
    <PageFrame toolbar={toolbar}>
      <SummaryTiles version={versions[index]} previous={versions[index - 1]} summary={versionSummary(metrics, index)} />
      {mode === "version" ? (
        <VersionSnapshot metrics={metrics} index={index} />
      ) : (
        <>
          {selectedMetric ? (
            <SelectedMetric key={metricId(selectedMetric)} metric={selectedMetric} versions={versions} />
          ) : null}
          {groupBySuite(metrics).map((group) => (
            <Stack key={group.suite} gap="sm">
              <HStack gap="sm" align="baseline">
                <Text textStyle="label/M/medium">{group.label}</Text>
                <Text textStyle="mono/XS" color="fg.muted" truncate>
                  {group.source}
                </Text>
              </HStack>
              <Grid templateColumns="repeat(auto-fill, minmax(16rem, 1fr))" gap="md">
                {group.metrics.map((metric) => (
                  <MetricCard
                    key={metricId(metric)}
                    metric={metric}
                    versions={versions}
                    selected={metric === selectedMetric}
                    onSelect={() => props.onSelect(metricId(metric))}
                  />
                ))}
              </Grid>
            </Stack>
          ))}
        </>
      )}
    </PageFrame>
  );
};

import { Grid, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { Tag } from "lucide-react";
import type { TrendMetric } from "../benchmarks/analysis";
import { PageFrame } from "../webview/page-frame";
import { PlatformControl } from "../webview/platform-control";
import { SelectMenu } from "../webview/select-menu";
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
  onPlatformChange: (platform: string) => void;
  onModeChange: (mode: TrendsMode) => void;
  onVersionChange: (index: number) => void;
  onSelect: (metric: string) => void;
}

export const TrendsView = (props: TrendsViewProps) => {
  const { versions, metrics, platform, mode, versionIndex, selected } = props;
  const index = mode === "versions" ? versions.length - 1 : versionIndex;
  const selectedMetric = metrics.find((metric) => metricId(metric) === selected) ?? metrics[0];
  // Tabs and dropdowns, like the collection view: the tabs switch the view, dropdowns pick its data.
  const toolbar = (
    <>
      <Tabs.Root
        size="sm"
        variant="subtle"
        value={mode}
        onValueChange={(details) => props.onModeChange(details.value as TrendsMode)}
      >
        <Tabs.List>
          <Tabs.Trigger value="versions">Across versions</Tabs.Trigger>
          <Tabs.Trigger value="version">One version</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      <HStack flex="1" justify="flex-end" gap="xs" minW="0">
        {mode === "version" && versions.length ? (
          <SelectMenu
            label="Version"
            icon={<Tag />}
            value={versions[versionIndex]}
            options={[...versions].reverse().map((version) => ({ value: version, label: version }))}
            onValueChange={(version) => props.onVersionChange(versions.indexOf(version))}
          />
        ) : null}
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
      <SummaryTiles version={versions[index]} summary={versionSummary(metrics, index)} />
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

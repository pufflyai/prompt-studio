import { Button, Grid, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { Tag } from "lucide-react";
import type { TrendMetric } from "../benchmarks/analysis";
import { PageFrame } from "../webview/page-frame";
import { PlatformControl } from "../webview/platform-control";
import { SelectMenu } from "../webview/select-menu";
import { SummaryTiles } from "./summary-tiles";
import { TrendCard } from "./trend-card";
import { groupBySuite, metricId, pickVersions, versionSummary } from "./trend-summary";
import { TrendsTable } from "./trends-table";
import { VersionSnapshot } from "./version-snapshot";
import { VersionsMenu } from "./versions-menu";

export type TrendsMode = "versions" | "version";

export interface TrendsViewProps {
  versions: string[];
  metrics: TrendMetric[];
  platform: string;
  mode: TrendsMode;
  versionIndex: number;
  chosenVersions?: string[];
  showTable: boolean;
  onPlatformChange: (platform: string) => void;
  onModeChange: (mode: TrendsMode) => void;
  onVersionChange: (index: number) => void;
  onChosenVersionsChange: (versions?: string[]) => void;
  onShowTableChange: (showTable: boolean) => void;
}

interface SeriesProps {
  versions: string[];
  metrics: TrendMetric[];
}

const TimeSeries = (props: SeriesProps) => {
  const { versions, metrics } = props;
  return groupBySuite(metrics).map((group) => (
    <Stack key={group.suite} gap="sm">
      <Text textStyle="label/M/medium">{group.label}</Text>
      <Grid templateColumns="repeat(auto-fill, minmax(24rem, 1fr))" gap="md">
        {group.metrics.map((metric) => (
          <TrendCard key={metricId(metric)} metric={metric} versions={versions} />
        ))}
      </Grid>
    </Stack>
  ));
};

export const TrendsView = (props: TrendsViewProps) => {
  const { versions, metrics, platform, mode, versionIndex, chosenVersions, showTable } = props;
  const series = pickVersions(versions, metrics, chosenVersions);
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
        {mode === "versions" && versions.length ? (
          <>
            <VersionsMenu versions={versions} chosen={chosenVersions} onChange={props.onChosenVersionsChange} />
            <Button
              size="xs"
              variant="ghost"
              aria-pressed={showTable}
              onClick={() => props.onShowTableChange(!showTable)}
            >
              {showTable ? "Show charts" : "Show table"}
            </Button>
          </>
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
  if (mode === "version")
    return (
      <PageFrame toolbar={toolbar}>
        <SummaryTiles version={versions[versionIndex]} summary={versionSummary(metrics, versionIndex)} />
        <VersionSnapshot metrics={metrics} index={versionIndex} />
      </PageFrame>
    );
  return (
    <PageFrame toolbar={toolbar}>
      {showTable ? (
        <TrendsTable versions={series.versions} metrics={series.metrics} />
      ) : (
        <TimeSeries versions={series.versions} metrics={series.metrics} />
      )}
    </PageFrame>
  );
};

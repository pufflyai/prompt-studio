import { Box, Button, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { PlatformTrend } from "../benchmarks/analysis";
import { platformLabel } from "../benchmarks/platforms";
import { PageFrame } from "../webview/page-frame";
import { PlatformsMenu } from "./platforms-menu";
import { TrendCard } from "./trend-card";
import { platformColor } from "./trend-chart";
import { groupBySuite, metricId, pickVersions } from "./trend-summary";
import { TrendsTable } from "./trends-table";
import { VersionsMenu } from "./versions-menu";

// One release history view. A single version's results are read on Compare by leaving the base empty.
export interface TrendsViewProps {
  versions: string[];
  trends: PlatformTrend[];
  platforms: string[];
  chosenVersions?: string[];
  showTable: boolean;
  // Shown above the charts, such as a release whose results are still running.
  notice?: ReactNode;
  onPlatformsChange: (platforms: string[]) => void;
  onChosenVersionsChange: (versions?: string[]) => void;
  onShowTableChange: (showTable: boolean) => void;
}

const Legend = (props: { platforms: string[] }) => (
  <HStack gap="md" wrap="wrap" role="list" aria-label="Platforms">
    {props.platforms.map((platform) => (
      <HStack key={platform} gap="xs" role="listitem" textStyle="label/S/regular" color="fg.muted">
        <Box w="3" h="0.5" borderRadius="full" bg={platformColor(platform)} />
        <Text>{platformLabel(platform)}</Text>
      </HStack>
    ))}
  </HStack>
);

export const TrendsView = (props: TrendsViewProps) => {
  const { versions, trends, platforms, chosenVersions, showTable } = props;
  const shown = trends
    .filter((entry) => platforms.includes(entry.platform))
    .map((entry) => ({ ...entry, ...pickVersions(versions, entry.metrics, chosenVersions) }));
  const shownVersions = shown[0]?.versions ?? versions;
  const toolbar = (
    <HStack flex="1" justify="flex-end" gap="xs" minW="0">
      {versions.length ? (
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
      <PlatformsMenu chosen={platforms} onChange={props.onPlatformsChange} />
    </HStack>
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
  const groups = groupBySuite(shown[0]?.metrics ?? []);
  return (
    <PageFrame toolbar={toolbar}>
      {props.notice}
      {showTable ? (
        <TrendsTable versions={shownVersions} platforms={shown} />
      ) : (
        <>
          {shown.length > 1 ? <Legend platforms={shown.map((entry) => entry.platform)} /> : null}
          {groups.map((group) => (
            <Stack key={group.suite} gap="sm">
              <Text textStyle="label/M/medium">{group.label}</Text>
              <Grid templateColumns="repeat(auto-fill, minmax(24rem, 1fr))" gap="md">
                {group.metrics.map((metric) => {
                  const id = metricId(metric);
                  const series = shown.flatMap((entry) => {
                    const match = entry.metrics.find((candidate) => metricId(candidate) === id);
                    return match ? [{ platform: entry.platform, metric: match }] : [];
                  });
                  return <TrendCard key={id} series={series} versions={shownVersions} />;
                })}
              </Grid>
            </Stack>
          ))}
        </>
      )}
    </PageFrame>
  );
};

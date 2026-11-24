import { Box, Button, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { CalendarDays, Layers, LayoutDashboard, RefreshCw } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { type Aggregation, aggregationOptions, type DateRange, rangeOptions } from "../webview/period";
import { SelectMenu } from "../webview/select-menu";
import { HealthDashboard } from "./health-dashboard";
import { buildHealthTimeline } from "./health-timeline";
import type { HealthHistory } from "./types";

// Hourly charts are limited to a week to keep the number of bars bounded.
const HOURLY_RANGE: DateRange = "7";
const hourOption = { value: "hour", label: "Hour" } satisfies (typeof aggregationOptions)[number];
const healthAggregationOptions = (range: DateRange) =>
  range === HOURLY_RANGE ? [hourOption, ...aggregationOptions] : aggregationOptions;

export interface HealthViewProps extends HealthHistory {
  today: string;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (url: string) => void;
}

export const HealthView = (props: HealthViewProps) => {
  const {
    today,
    runs,
    pullRequestMerges,
    pullRequestMergesDaily,
    pullRequestMergesHourly,
    pullRequestMergesError,
    bugOriginCoverage,
    publications,
    publicationsError,
    error,
    refreshing,
    onRefresh,
    onOpen,
  } = props;
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const [chosen, setChosen] = useState<number>();
  const [range, setRange] = useState<DateRange>("30");
  const [chosenAggregation, setAggregation] = useState<Aggregation>("day");
  const aggregation = chosenAggregation === "hour" && range !== HOURLY_RANGE ? "day" : chosenAggregation;
  const { buckets, selectedRuns } = buildHealthTimeline({
    today,
    range,
    aggregation,
    runs,
    merges: pullRequestMergesDaily ?? pullRequestMerges ?? [],
    hourlyMerges: pullRequestMergesHourly,
    publications: publications ?? [],
  });

  return (
    <Tabs.Root value="overview" size="sm" h="full" minH="0" display="flex" flexDirection="column">
      <HStack gap="sm" p="xs" flexShrink={0} flexWrap="wrap" borderBottomWidth="1px" borderColor="border.subtle">
        <Tabs.List>
          <Tabs.Trigger value="overview">
            <LayoutDashboard aria-hidden />
            Overview
          </Tabs.Trigger>
        </Tabs.List>
        <SelectMenu
          label="Range"
          icon={<CalendarDays />}
          value={range}
          options={rangeOptions}
          onValueChange={(value) => setRange(value as DateRange)}
        />
        <SelectMenu
          label="Aggregation"
          icon={<Layers />}
          value={aggregation}
          options={healthAggregationOptions(range)}
          onValueChange={(value) => setAggregation(value as Aggregation)}
        />
        <HStack ml="auto" gap="xs" flexWrap="wrap">
          <Box ref={setToolbar} />
          <Button size="xs" variant="ghost" loading={refreshing} onClick={onRefresh}>
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        </HStack>
      </HStack>
      <Stack flexShrink={0} gap="0">
        {error ? (
          <AlertMessage status="error" title="Release results could not be refreshed">
            {error}
          </AlertMessage>
        ) : null}
        {publicationsError ? (
          <AlertMessage status="warning" title="Release dates could not be refreshed">
            {publicationsError}
          </AlertMessage>
        ) : null}
        {buckets.some((bucket) => bucket.publications.length) ? (
          <HStack color="fg.muted" gap="xs" px="md" pt="xs">
            <Box w="4" borderTopWidth="1px" borderTopStyle="dashed" borderColor="currentColor" />
            <Text textStyle="label/XS">Published pstdio releases · UTC</Text>
          </HStack>
        ) : null}
      </Stack>
      <Tabs.Content value="overview" flex="1" minH="0" pt="0">
        <HealthDashboard
          buckets={buckets}
          runs={selectedRuns}
          aggregation={aggregation}
          bugOriginCoverage={bugOriginCoverage}
          pullRequestMergesError={pullRequestMergesError}
          chosen={chosen}
          onChoose={setChosen}
          onOpen={onOpen}
          renderToolbar={(controls) => (toolbar ? createPortal(controls, toolbar) : null)}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
};

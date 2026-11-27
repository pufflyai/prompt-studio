import { Box, Button, ButtonPropsProvider, HStack, Stack, Text, useRecipe } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { CalendarDays, Layers, RefreshCw } from "lucide-react";
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
const toolbarButton = { size: "sm", variant: "outline" } as const;

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
    mergeThemes,
    mergeThemesError,
    bugFailurePatterns,
    bugFailurePatternsError,
    bugOriginCoverage,
    publications,
    publicationsError,
    error,
    refreshing,
    onRefresh,
    onOpen,
  } = props;
  const buttonRecipe = useRecipe({ key: "button" });
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
  const runEmptyTitle = runs.length ? "No release runs in this range" : "No release results yet";

  return (
    <Stack gap="0" w="full" h="full" minW="0" minH="0">
      <HStack
        role="group"
        aria-label="Release health controls"
        gap="sm"
        p="xs"
        flexShrink={0}
        flexWrap="wrap"
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
        <HStack gap="xs" flexWrap="wrap" minW="0">
          <Button {...toolbarButton} loading={refreshing} onClick={onRefresh}>
            <RefreshCw aria-hidden />
            Refresh
          </Button>
          <SelectMenu
            label="Range"
            icon={<CalendarDays />}
            value={range}
            options={rangeOptions}
            onValueChange={(value) => setRange(value as DateRange)}
            triggerProps={toolbarButton}
          />
          <SelectMenu
            label="Aggregation"
            icon={<Layers />}
            value={aggregation}
            options={healthAggregationOptions(range)}
            onValueChange={(value) => setAggregation(value as Aggregation)}
            triggerProps={toolbarButton}
          />
        </HStack>
        <Box
          ref={setToolbar}
          ml="auto"
          minW="0"
          css={{
            '& button[aria-label="Display settings"]': {
              ...buttonRecipe(toolbarButton),
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "border",
              px: "2",
              _after: { content: "attr(aria-label)" },
            },
            '& [aria-label="Dashboard controls"] > .chakra-stack': {
              borderInlineStartWidth: "1px",
              borderColor: "border.subtle",
              ps: "xs",
            },
          }}
        />
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
      <Box flex="1" minH="0">
        <HealthDashboard
          buckets={buckets}
          runs={selectedRuns}
          aggregation={aggregation}
          hasRunHistory={runs.length > 0}
          runEmptyTitle={refreshing && !runs.length ? "Collecting release results" : runEmptyTitle}
          bugOriginCoverage={bugOriginCoverage}
          pullRequestMergesError={pullRequestMergesError}
          mergeThemes={mergeThemes}
          mergeThemesError={mergeThemesError}
          bugFailurePatterns={bugFailurePatterns}
          bugFailurePatternsError={bugFailurePatternsError}
          chosen={chosen}
          onChoose={setChosen}
          onOpen={onOpen}
          renderToolbar={(controls) =>
            toolbar
              ? createPortal(<ButtonPropsProvider value={toolbarButton}>{controls}</ButtonPropsProvider>, toolbar)
              : null
          }
        />
      </Box>
    </Stack>
  );
};

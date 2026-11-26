import { Box, chakra, Flex, Grid, Stack, Text } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceActivity } from "./workspace-history";
import { drawWorkspaceHistory } from "./workspace-history-chart";
import type { MonitoringClient } from "./workspace-monitoring-client";
import { monitoringFormat, type Translate } from "./workspace-monitoring-ui";

interface ActivityChartProps extends Pick<WorkspaceActivity, "points" | "peak"> {
  locale: string;
  t: Translate;
}

export function ActivityChart({ points, peak, locale, t }: ActivityChartProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<number>();
  const selected = Math.min(cursor ?? points.length - 1, points.length - 1);
  const point = points[selected];
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => drawWorkspaceHistory(element, points, peak, selected, locale);
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, [points, peak, selected, locale]);

  return (
    <Stack gap="xs">
      <Box
        asChild
        w="full"
        h="3xs"
        css={{
          "--history-text": psTheme.token.var("colors.fg.muted"),
          "--history-grid": psTheme.token.var("colors.border"),
          "--history-line": psTheme.token.var("colors.vis.categorical.1"),
          "--history-fill": psTheme.token.var("colors.bg.muted"),
        }}
      >
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label={t("cloud-workspaces.history-accessible-plot", "Running workspaces over time")}
          aria-describedby="monitoring-activity-point"
          onPointerMove={(event) => {
            const first = points[0];
            const last = points.at(-1);
            if (!first || !last) return;
            const position = (event.nativeEvent.offsetX - 36) / (event.currentTarget.clientWidth - 54);
            const time = first.time + position * (last.time - first.time);
            setCursor(
              Math.max(
                0,
                points.findLastIndex((value) => value.time <= time),
              ),
            );
          }}
          onPointerLeave={() => setCursor(undefined)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setCursor(Math.min(points.length - 1, Math.max(0, selected + (event.key === "ArrowLeft" ? -1 : 1))));
          }}
        />
      </Box>
      <Text id="monitoring-activity-point" aria-live="polite" textStyle="label/S/regular" color="fg.muted">
        {point &&
          `${new Date(point.time).toLocaleString(locale)} · ${t("cloud-workspaces.history-running-count", "{{count}} running", { count: point.count })}`}
      </Text>
    </Stack>
  );
}

type Bucket = Awaited<ReturnType<MonitoringClient["commands"]["deployed.monitoring-summary"]>>["buckets"][number];

export function CostChart({ buckets, locale, t }: { buckets: Bucket[]; locale: string; t: Translate }) {
  const [index, setIndex] = useState(buckets.length - 1);
  const bucket = buckets[index];
  const format = monitoringFormat(locale, t);
  const max = Math.max(0.01, ...buckets.map(({ costUsd }) => costUsd ?? 0));
  const coverage = (runtime: number) =>
    runtime > 0
      ? t("cloud-workspaces.monitoring-missing-rates", "{{runtime}} without a rate", { runtime: format.hours(runtime) })
      : "";

  return (
    <Stack gap="xs">
      <Grid templateColumns={`repeat(${buckets.length}, minmax(0, 1fr))`} gap="xs" h="3xs" borderBottomWidth="1px">
        {buckets.map(({ from, costUsd, unpricedRuntimeMs }, index) => (
          <chakra.button
            key={from}
            type="button"
            h="full"
            display="flex"
            alignItems="end"
            aria-label={[`${format.date.format(from)} · ${format.money(costUsd)}`, coverage(unpricedRuntimeMs)]
              .filter(Boolean)
              .join(" · ")}
            onFocus={() => setIndex(index)}
            onPointerEnter={() => setIndex(index)}
            onClick={() => setIndex(index)}
          >
            <Box
              w="full"
              h={`${((costUsd ?? 0) / max) * 100}%`}
              minH="1"
              roundedTop="xs"
              bg={unpricedRuntimeMs > 0 ? "fg.muted" : "vis.categorical.2"}
            />
          </chakra.button>
        ))}
      </Grid>
      <Flex justify="space-between" gap="xs" color="fg.muted" textStyle="label/XS/regular">
        <Text>{format.date.format(buckets[0].from)}</Text>
        <Text>{format.date.format(buckets.at(-1)?.to)}</Text>
      </Flex>
      <Text aria-live="polite" textStyle="label/S/regular" color="fg.muted">
        {[
          format.date.formatRange(bucket.from, bucket.to),
          format.money(bucket.costUsd),
          coverage(bucket.unpricedRuntimeMs),
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </Stack>
  );
}

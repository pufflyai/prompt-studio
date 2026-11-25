import { Box, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { type ReactNode, useId } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { SimpleCard } from "@/components/primitives/simple-card";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { UiScopeActivity } from "@/utils/ui-scope";
import { DashboardChart } from "./dashboard-chart";
import { resolveWidgetColor } from "./dashboard-colors";
import { DashboardRingChart } from "./dashboard-ring-chart";
import { DashboardScatterChart } from "./dashboard-scatter-chart";
import { type DashboardDataSource, type DashboardWidget, widgetLabel } from "./dashboard-types";

interface WidgetCardProps {
  widget: DashboardWidget;
  hidden: boolean;
  source?: DashboardDataSource;
  originalCustomSource?: DashboardDataSource;
  controls?: ReactNode;
}

const customContent = (widget: DashboardWidget, source?: DashboardDataSource) => {
  if (typeof source?.content !== "function") return source?.content;
  return source.content({
    title: widget.title.trim() || undefined,
    description: widget.description,
    color: resolveWidgetColor(widget.color),
    seriesColors: Object.fromEntries(
      Object.entries(widget.seriesColors ?? {}).flatMap(([key, value]) => {
        const color = resolveWidgetColor(value);
        return color ? [[key, color]] : [];
      }),
    ),
  });
};

function WidgetHeading(props: { title: string; description?: string; controls?: ReactNode }) {
  const { title, description, controls } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  if (!title && !description && !controls) return null;
  return (
    <HStack css={styles.cardHeader}>
      {(title || description) && (
        <Stack css={styles.cardHeading}>
          {title && (
            <Text as="h2" textStyle="label/S/medium">
              {title}
            </Text>
          )}
          {description && <Text css={styles.cardDescription}>{description}</Text>}
        </Stack>
      )}
      {controls}
    </HStack>
  );
}

export function WidgetCard(props: WidgetCardProps) {
  const { widget, hidden, source, originalCustomSource, controls } = props;
  const tableKey = useId();
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();

  const cardDescription = widget.kind === "metric" ? undefined : widget.description?.trim();
  const metricDescription = widget.description ?? source?.metric?.description;
  const activeCustomSourceId = widget.kind === "custom" ? widget.source : undefined;
  const customSourceIds = activeCustomSourceId === undefined ? [] : [activeCustomSourceId];
  // Keep the saved source mounted while the draft previews another source or type.
  if (originalCustomSource && originalCustomSource.id !== activeCustomSourceId) {
    customSourceIds.push(originalCustomSource.id);
  }
  return (
    <SimpleCard
      as="article"
      aria-label={widgetLabel(widget, source?.name)}
      h="full"
      minH="0"
      display="flex"
      flexDirection="column"
      position="relative"
      borderRadius="inherit"
      data-dashboard-widget-body=""
    >
      <WidgetHeading title={widget.title.trim()} description={cardDescription} controls={controls} />
      {widget.kind === "metric" && (
        <Box px="md" pb="md" flex="1" minH="0" display="flex" flexDirection="column" justifyContent="center">
          <HStack align="center" justify="space-between" gap="md">
            <Text textStyle="heading/M">{source?.metric?.value ?? "—"}</Text>
            {source && Boolean(source.series?.length) && (
              <Box w="24" h="12" minW="0">
                <DashboardChart widget={widget} source={source} sparkline />
              </Box>
            )}
          </HStack>
          {metricDescription && <Text css={styles.cardDescription}>{metricDescription}</Text>}
        </Box>
      )}
      {(widget.kind === "line" || widget.kind === "bar") && (
        <Box css={styles.plot}>
          {source?.series?.length ? (
            <DashboardChart widget={widget} source={source} />
          ) : (
            <Text color="fg.muted" textStyle="label/S/regular">
              No chart data
            </Text>
          )}
        </Box>
      )}
      {widget.kind === "scatter" && (
        <Box css={styles.plot}>
          <DashboardScatterChart widget={widget} scatter={source?.scatter} />
        </Box>
      )}
      {widget.kind === "ring" && (
        <Box css={styles.plot}>
          <DashboardRingChart widget={widget} series={source?.series} />
        </Box>
      )}
      {widget.kind === "table" && (
        <Box css={styles.plot}>
          {source?.table ? (
            <DataTable
              {...source.table}
              isReadOnly
              selectionMode="none"
              fullWidth
              toolbarStorageKey={`dashboard-${tableKey}-${widget.source}`}
            />
          ) : (
            <Text color="fg.muted" textStyle="label/S/regular">
              No table data
            </Text>
          )}
        </Box>
      )}
      {customSourceIds.map((id) => {
        const selected = id === activeCustomSourceId;
        const active = selected && !hidden;
        return (
          <UiScopeActivity key={id} active={active}>
            <ScrollArea hidden={!active} css={styles.customContent} contentProps={{ p: "sm" }}>
              {customContent(widget, selected ? source : originalCustomSource) ?? (
                <Text color="fg.muted" textStyle="label/S/regular">
                  No widget content
                </Text>
              )}
            </ScrollArea>
          </UiScopeActivity>
        );
      })}
    </SimpleCard>
  );
}

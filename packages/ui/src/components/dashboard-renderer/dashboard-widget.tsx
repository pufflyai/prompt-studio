import { Box, HStack, Text, useSlotRecipe } from "@chakra-ui/react";
import { type ReactNode, useId } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { SimpleCard } from "@/components/primitives/simple-card";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { DashboardChart } from "./dashboard-chart";
import { type DashboardDataSource, type DashboardWidget, widgetLabel } from "./dashboard-types";

interface WidgetCardProps {
  widget: DashboardWidget;
  source?: DashboardDataSource;
  controls?: ReactNode;
}

export function WidgetCard(props: WidgetCardProps) {
  const { widget, source, controls } = props;
  const tableKey = useId();
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();

  const titled = Boolean(widget.title.trim());
  return (
    <SimpleCard
      as="article"
      aria-label={widgetLabel(widget)}
      h="full"
      minH="0"
      display="flex"
      flexDirection="column"
      position="relative"
      borderRadius="inherit"
      data-dashboard-widget-body=""
    >
      {(titled || controls) && (
        <HStack css={styles.cardHeader}>
          {titled && (
            <Text as="h2" textStyle="label/S/medium" flex="1" minW="0" overflowWrap="anywhere">
              {widget.title}
            </Text>
          )}
          {controls}
        </HStack>
      )}
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
          {source?.metric?.description && (
            <Text textStyle="label/XS/regular" color="fg.muted">
              {source.metric.description}
            </Text>
          )}
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
    </SimpleCard>
  );
}

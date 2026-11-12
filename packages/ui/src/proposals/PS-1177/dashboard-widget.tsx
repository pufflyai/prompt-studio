import { Box, HStack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { SimpleCard } from "@/components/primitives/simple-card";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { DashboardChart } from "./dashboard-chart";
import { changes, type DashboardWidget, recentTotals, sourceTables, totals, widgetLabel } from "./dashboard-fixtures";

interface WidgetCardProps {
  widget: DashboardWidget;
  days: number;
  controls?: ReactNode;
}

export function WidgetCard(props: WidgetCardProps) {
  const { widget, days, controls } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const total = days === 7 ? totals[widget.source] : recentTotals[widget.source];
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
            <Text textStyle="heading/M">{total}</Text>
            <Box w="24" h="12" minW="0">
              <DashboardChart widget={widget} days={days} sparkline />
            </Box>
          </HStack>
          {days === 7 && (
            <Text textStyle="label/XS/regular" color="fg.muted">
              {changes[widget.source]} from last week
            </Text>
          )}
        </Box>
      )}
      {(widget.kind === "line" || widget.kind === "bar") && (
        <Box css={styles.plot}>
          <DashboardChart widget={widget} days={days} />
        </Box>
      )}
      {widget.kind === "table" && (
        <Box css={styles.plot}>
          <DataTable
            data={sourceTables[widget.source]}
            isReadOnly
            selectionMode="none"
            fullWidth
            toolbarStorageKey={`proposal-1177-${widget.id}-${widget.source}`}
            columnTypes={{ Warnings: "number", Conversations: "number" }}
          />
        </Box>
      )}
    </SimpleCard>
  );
}

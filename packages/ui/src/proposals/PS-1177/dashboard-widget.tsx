import { Box, HStack, IconButton, Text, useSlotRecipe } from "@chakra-ui/react";
import { GripVertical, Settings2 } from "lucide-react";
import type { ComponentProps } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { SimpleCard } from "@/components/primitives/simple-card";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { DashboardChart } from "./dashboard-chart";
import { changes, type DashboardWidget, recentTotals, sourceTables, totals } from "./dashboard-fixtures";

interface WidgetCardProps {
  widget: DashboardWidget;
  editing: boolean;
  selected: boolean;
  days: number;
  dragHandle: ComponentProps<typeof IconButton>;
  onConfigure: () => void;
}

export function WidgetCard(props: WidgetCardProps) {
  const { widget, editing, selected, days, dragHandle, onConfigure } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const total = days === 7 ? totals[widget.source] : recentTotals[widget.source];
  return (
    <SimpleCard
      as="article"
      aria-label={widget.title}
      h="full"
      minH="0"
      display="flex"
      flexDirection="column"
      position="relative"
      data-dashboard-widget-body=""
    >
      <HStack css={styles.cardHeader}>
        {editing && (
          <IconButton
            {...dragHandle}
            aria-label={`Drag ${widget.title}`}
            title="Drag to move. Space to pick up, arrow keys to move, Enter to drop."
            size="xs"
            variant="ghost"
            css={styles.dragHandle}
          >
            <GripVertical />
          </IconButton>
        )}
        <Text as="h2" textStyle="label/S/medium" flex="1" minW="0" overflowWrap="anywhere">
          {widget.title}
        </Text>
        {editing && (
          <IconButton
            aria-label={`Configure ${widget.title}`}
            data-configure-widget={widget.id}
            aria-pressed={selected}
            size="xs"
            variant="ghost"
            onClick={onConfigure}
          >
            <Settings2 />
          </IconButton>
        )}
      </HStack>
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

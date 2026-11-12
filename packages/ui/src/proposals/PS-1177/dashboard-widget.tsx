import { Box, HStack, IconButton, Text, useSlotRecipe } from "@chakra-ui/react";
import { ArrowDown, ArrowUp, GripVertical, Settings2 } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { SimpleCard } from "@/components/primitives/simple-card";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { DashboardChart } from "./dashboard-chart";
import { changes, type DashboardWidget, recentTotals, sourceTables, totals } from "./dashboard-fixtures";

interface WidgetCardProps {
  widget: DashboardWidget;
  editing: boolean;
  selected: boolean;
  first: boolean;
  last: boolean;
  days: number;
  onConfigure: () => void;
  onMove: (offset: number) => void;
  onDrop: (id: string) => void;
}

export function WidgetCard(props: WidgetCardProps) {
  const { widget, editing, selected, first, last, days, onConfigure, onMove, onDrop } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const total = days === 7 ? totals[widget.source] : recentTotals[widget.source];
  return (
    <Box
      as="article"
      aria-label={widget.title}
      css={styles.card}
      data-widget-id={widget.id}
      data-width={widget.width}
      data-selected={selected}
      onDragOver={(event) => {
        if (editing) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (editing) onDrop(event.dataTransfer.getData("text/plain"));
      }}
    >
      <SimpleCard>
        <HStack css={styles.cardHeader}>
          {editing && (
            <IconButton
              aria-label={`Drag ${widget.title}`}
              title="Drag to reorder. Use the move buttons with a keyboard."
              size="xs"
              variant="ghost"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", widget.id);
                event.dataTransfer.effectAllowed = "move";
              }}
            >
              <GripVertical />
            </IconButton>
          )}
          <Text as="h2" textStyle="label/S/medium" flex="1" minW="0" overflowWrap="anywhere">
            {widget.title}
          </Text>
          {editing && (
            <HStack gap="0">
              <IconButton
                aria-label={`Move ${widget.title} earlier`}
                size="xs"
                variant="ghost"
                disabled={first}
                onClick={() => onMove(-1)}
              >
                <ArrowUp />
              </IconButton>
              <IconButton
                aria-label={`Move ${widget.title} later`}
                size="xs"
                variant="ghost"
                disabled={last}
                onClick={() => onMove(1)}
              >
                <ArrowDown />
              </IconButton>
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
            </HStack>
          )}
        </HStack>
        {widget.kind === "metric" && (
          <Box px="md" pb="md">
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
          <Box css={styles.plot} data-height={widget.height}>
            <DashboardChart widget={widget} days={days} />
          </Box>
        )}
        {widget.kind === "table" && (
          <Box css={styles.plot} data-height={widget.height}>
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
    </Box>
  );
}

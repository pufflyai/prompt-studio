import { Box, HStack, IconButton, useSlotRecipe } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type { Ref } from "react";
import { Resizable } from "react-resizable";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import type { DashboardResizeHandle, DashboardWidget } from "./dashboard-fixtures";
import { type measureGrid, placementStyle } from "./dashboard-grid-geometry";
import { WidgetCard } from "./dashboard-widget";
import { WidgetSettings } from "./dashboard-widget-settings";
import type { useDashboardResize } from "./use-dashboard-resize";

interface GridWidgetProps {
  widget: DashboardWidget;
  editing: boolean;
  selectedId: string | null;
  days: number;
  moving: boolean;
  resizing: boolean;
  columns: number;
  metrics: ReturnType<typeof measureGrid> | null;
  resizeController: ReturnType<typeof useDashboardResize>;
  onConfigure: (id: string | null) => void;
  onWidgetChange: (widget: DashboardWidget) => void;
  onRemove: (id: string) => void;
}

const handleNames = { w: "left", e: "right", s: "bottom", sw: "bottom left", se: "bottom right" };
const resizeHandles: DashboardResizeHandle[] = ["w", "e", "sw", "s", "se"];

export function GridWidget(props: GridWidgetProps) {
  const {
    widget,
    editing,
    selectedId,
    days,
    moving,
    resizing,
    onConfigure,
    onWidgetChange,
    onRemove,
    resizeController,
    columns,
    metrics,
  } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const draggable = useDraggable({ id: widget.id, disabled: !editing });
  const selected = selectedId === widget.id;
  const content = (
    <Box
      ref={draggable.setNodeRef}
      css={styles.card}
      style={placementStyle(widget.layout)}
      role={editing ? "group" : undefined}
      aria-label={editing ? `Edit ${widget.title}` : undefined}
      tabIndex={editing ? 0 : undefined}
      data-widget-id={widget.id}
      data-moving={moving}
      data-selected={selected}
      data-resizing={resizing}
    >
      <WidgetCard widget={widget} days={days} />
      {editing && (
        <>
          <Box aria-hidden css={styles.selectionOutline} data-dashboard-selection="" />
          <HStack css={styles.widgetToolbar} data-dashboard-controls="" aria-label={`${widget.title} controls`}>
            <IconButton
              {...draggable.attributes}
              {...draggable.listeners}
              ref={draggable.setActivatorNodeRef}
              aria-label={`Drag ${widget.title}`}
              title="Drag to move. Space to pick up, arrow keys to move, Enter to drop."
              size="2xs"
              variant="ghost"
              css={styles.dragHandle}
            >
              <GripVertical />
            </IconButton>
            <WidgetSettings
              widget={widget}
              open={selected}
              onOpenChange={(open) => onConfigure(open ? widget.id : null)}
              onChange={onWidgetChange}
              onRemove={() => onRemove(widget.id)}
            />
          </HStack>
        </>
      )}
      {(moving || resizing) && (
        <Box
          aria-hidden
          css={styles.highlight}
          layerStyle="panelDropZone"
          data-drop-active
          data-dashboard-drop-preview=""
        >
          <Box css={styles.sizeLabel} layerStyle="floatingBar">
            {widget.layout.w} × {widget.layout.h}
          </Box>
        </Box>
      )}
    </Box>
  );
  if (!editing || !metrics) return content;
  return (
    <Resizable
      {...resizeController.resizableProps(widget, metrics)}
      axis={columns === 1 ? "y" : "both"}
      resizeHandles={columns === 1 ? ["s"] : resizeHandles}
      handle={(axis, ref) => (
        <IconButton
          ref={ref as Ref<HTMLButtonElement>}
          aria-label={`Resize ${widget.title} from ${handleNames[axis as DashboardResizeHandle]}`}
          title="Drag to resize. Arrow keys move this edge."
          data-dashboard-controls=""
          data-resize-axis={axis}
          size="2xs"
          variant="ghost"
          css={styles.resizeHandle}
          onKeyDown={(event) => resizeController.onHandleKeyDown(widget.id, axis as DashboardResizeHandle, event)}
        >
          <Box aria-hidden css={styles.resizeMarker} />
        </IconButton>
      )}
    >
      {content}
    </Resizable>
  );
}

import { Box, HStack, IconButton, useSlotRecipe } from "@chakra-ui/react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type { Ref } from "react";
import { Resizable } from "react-resizable";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { type measureGrid, placementStyle } from "./dashboard-grid-geometry";
import {
  type DashboardDataSource,
  type DashboardResizeHandle,
  type DashboardWidget,
  widgetLabel,
} from "./dashboard-types";
import { WidgetCard } from "./dashboard-widget";
import { WidgetSettings } from "./dashboard-widget-settings";
import type { useDashboardResize } from "./use-dashboard-resize";

interface GridWidgetProps {
  widget: DashboardWidget;
  hidden: boolean;
  editing: boolean;
  selectedId: string | null;
  sources: DashboardDataSource[];
  moving: boolean;
  showDropPreview: boolean;
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
const verticalResizeHandles: DashboardResizeHandle[] = ["s"];

export function GridWidget(props: GridWidgetProps) {
  const {
    widget,
    hidden,
    editing,
    selectedId,
    sources,
    moving,
    showDropPreview,
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
  const source = sources.find(({ id }) => id === widget.source);
  const label = widgetLabel(widget, source?.name);
  const content = (
    <Box
      ref={draggable.setNodeRef}
      css={styles.card}
      hidden={hidden}
      style={placementStyle(widget.layout)}
      role={editing ? "group" : undefined}
      aria-label={editing ? `Edit ${label}` : undefined}
      tabIndex={editing ? 0 : undefined}
      data-widget-id={widget.id}
      data-moving={moving}
      data-selected={selected}
      data-resizing={resizing}
    >
      <WidgetCard
        widget={widget}
        source={source}
        controls={
          editing ? (
            <HStack css={styles.widgetToolbar} data-dashboard-controls="" aria-label={`${label} controls`}>
              <IconButton
                {...draggable.attributes}
                {...draggable.listeners}
                ref={draggable.setActivatorNodeRef}
                aria-label={`Drag ${label}`}
                title="Drag to move. Space to pick up, arrow keys to move, Enter to drop."
                size="2xs"
                variant="ghost"
                css={styles.dragHandle}
              >
                <GripVertical />
              </IconButton>
              <WidgetSettings
                widget={widget}
                sources={sources}
                open={selected}
                onOpenChange={(open) => onConfigure(open ? widget.id : null)}
                onChange={onWidgetChange}
                onRemove={() => onRemove(widget.id)}
              />
            </HStack>
          ) : undefined
        }
      />
      {editing && <Box aria-hidden css={styles.selectionOutline} data-dashboard-selection="" />}
      {showDropPreview && (
        <Box aria-hidden css={styles.highlight} data-drop-active data-dashboard-drop-preview="">
          <Box css={styles.sizeLabel} layerStyle="floatingBar">
            {widget.layout.w} × {widget.layout.h}
          </Box>
        </Box>
      )}
      {resizing && (
        <Box aria-hidden css={styles.sizeLabel} layerStyle="floatingBar" data-dashboard-resize-preview="">
          {widget.layout.w} × {widget.layout.h}
        </Box>
      )}
    </Box>
  );
  const resizeProps = editing && metrics ? resizeController.resizableProps(widget, metrics) : null;
  const axis = columns === 1 ? "y" : "both";
  const handles = columns === 1 ? verticalResizeHandles : resizeHandles;
  // Keep caller content mounted when editing starts or ends.
  return (
    <Resizable
      {...(resizeProps ?? { width: 0, height: 0 })}
      axis={resizeProps ? axis : "none"}
      resizeHandles={resizeProps ? handles : []}
      handle={(axis, ref) => (
        <IconButton
          ref={ref as Ref<HTMLButtonElement>}
          aria-label={`Resize ${label} from ${handleNames[axis as DashboardResizeHandle]}`}
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

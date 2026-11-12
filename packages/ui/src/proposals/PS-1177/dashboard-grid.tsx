import { Box, HStack, Text, useSlotRecipe } from "@chakra-ui/react";
import {
  DndContext,
  DragOverlay,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import type { DashboardWidget, GridPlacement } from "./dashboard-fixtures";
import { measureGrid, placementStyle } from "./dashboard-grid-geometry";
import { dashboardColumns, moveWidget, projectWidgets, resizeWidget } from "./dashboard-layout";
import { WidgetCard } from "./dashboard-widget";
import { useDashboardResize } from "./use-dashboard-resize";

interface GridProps {
  widgets: DashboardWidget[];
  editing: boolean;
  selectedId: string | null;
  days: number;
  onChange: (widgets: DashboardWidget[]) => void;
  onConfigure: (id: string) => void;
  onGestureStart: () => void;
}
interface DragSession {
  id: string;
  origin: GridPlacement;
  candidate: GridPlacement;
  metrics: { column: number; row: number };
}

interface GridWidgetProps extends GridProps {
  widget: DashboardWidget;
  moving: boolean;
  resizing: boolean;
  resizeHandlers: ReturnType<typeof useDashboardResize>["handlers"];
}
function GridWidget(props: GridWidgetProps) {
  const { widget, editing, selectedId, days, moving, resizing, onConfigure, resizeHandlers } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const draggable = useDraggable({ id: widget.id, disabled: !editing });
  return (
    <Box
      ref={draggable.setNodeRef}
      css={styles.card}
      style={placementStyle(widget.layout)}
      data-widget-id={widget.id}
      data-moving={moving}
    >
      <WidgetCard
        widget={widget}
        editing={editing}
        selected={widget.id === selectedId}
        days={days}
        dragHandle={{ ...draggable.attributes, ...draggable.listeners, ref: draggable.setActivatorNodeRef }}
        resizeHandlers={resizeHandlers(widget.id)}
        onConfigure={() => onConfigure(widget.id)}
      />
      {(moving || resizing || selectedId === widget.id) && (
        <Box
          aria-hidden
          css={styles.highlight}
          layerStyle={moving || resizing ? "panelDropZone" : "tabDropZone"}
          data-drop-active={moving || resizing || undefined}
          data-dashboard-drop-preview={moving || resizing ? "" : undefined}
        >
          {(moving || resizing) && (
            <Box css={styles.sizeLabel} layerStyle="floatingBar">
              <Text textStyle="label/XS/medium">
                {widget.layout.w} × {widget.layout.h}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

interface GridSurfaceProps {
  grid: RefObject<HTMLDivElement | null>;
  columns: number;
  rowCount: number;
  editing: boolean;
  onEscape: () => void;
  children: ReactNode;
}
function GridSurface(props: GridSurfaceProps) {
  const { grid, columns, rowCount, editing, onEscape, children } = props;
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const { setNodeRef } = useDroppable({ id: "dashboard-grid", disabled: !editing });
  return (
    <Box
      ref={(element: HTMLDivElement | null) => {
        grid.current = element;
        setNodeRef(element);
      }}
      css={styles.grid}
      data-dashboard-grid=""
      data-columns={columns}
      data-editing={editing}
      style={{ "--dashboard-grid-rows": rowCount } as CSSProperties}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") onEscape();
      }}
    >
      {editing && (
        <Box css={styles.guides} aria-hidden data-dashboard-grid-guides="">
          {Array.from({ length: columns * rowCount }, (_, index) => (
            <Box key={index} css={styles.guideCell} />
          ))}
        </Box>
      )}
      {children}
    </Box>
  );
}

export function DashboardGrid(props: GridProps) {
  const { widgets, editing, onChange, onGestureStart } = props;
  const grid = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(12);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const projected = projectWidgets(widgets, columns);
  const resizing = useDashboardResize({ widgets, projected, columns, grid, onChange, onGestureStart });
  const preview = drag ? moveWidget(widgets, drag.id, drag.candidate, columns) : widgets;
  const sized = resizing.resize ? resizeWidget(preview, resizing.resize.id, resizing.resize.size, columns) : preview;
  const visible = projectWidgets(sized, columns);
  useEffect(() => {
    if (!grid.current) return;
    const observer = new ResizeObserver(([entry]) => setColumns(dashboardColumns(entry.contentRect.width)));
    observer.observe(grid.current);
    return () => observer.disconnect();
  }, []);
  const coordinateGetter: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
    if (!grid.current) return;
    const step = measureGrid(grid.current, columns);
    const directions: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -step.column, y: 0 },
      ArrowRight: { x: step.column, y: 0 },
      ArrowUp: { x: 0, y: -step.row },
      ArrowDown: { x: 0, y: step.row },
    };
    const direction = directions[event.code];
    if (direction) {
      event.preventDefault();
      return { x: currentCoordinates.x + direction.x, y: currentCoordinates.y + direction.y };
    }
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );
  const active = widgets.find((widget) => widget.id === drag?.id);
  const rowCount = Math.max(1, ...visible.map((widget) => widget.layout.y + widget.layout.h)) + (editing ? 3 : 0);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args))}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Press Space to pick up a widget, arrow keys to move it, Enter to drop, or Escape to cancel.",
        },
      }}
      onDragStart={({ active }) => {
        const widget = projected.find((item) => item.id === active.id);
        if (!widget || !grid.current) return;
        onGestureStart();
        setDrag({
          id: widget.id,
          origin: widget.layout,
          candidate: widget.layout,
          metrics: measureGrid(grid.current, columns),
        });
      }}
      onDragMove={({ delta }) =>
        setDrag(
          (previous) =>
            previous && {
              ...previous,
              candidate: {
                ...previous.origin,
                x: Math.max(
                  0,
                  Math.min(
                    columns - previous.origin.w,
                    previous.origin.x + Math.round(delta.x / previous.metrics.column),
                  ),
                ),
                y: Math.max(0, previous.origin.y + Math.round(delta.y / previous.metrics.row)),
              },
            },
        )
      }
      onDragEnd={({ over }) => {
        if (drag && over) onChange(preview);
        setDrag(null);
      }}
      onDragCancel={() => setDrag(null)}
    >
      <GridSurface grid={grid} columns={columns} rowCount={rowCount} editing={editing} onEscape={resizing.cancel}>
        {visible.map((widget) => (
          <GridWidget
            key={widget.id}
            {...props}
            widget={widget}
            moving={drag?.id === widget.id}
            resizing={resizing.resize?.id === widget.id}
            resizeHandlers={resizing.handlers}
          />
        ))}
      </GridSurface>
      <DragOverlay dropAnimation={null}>
        {active && (
          <HStack layerStyle="floatingBar" pointerEvents="none">
            <GripVertical />
            <Text textStyle="label/S/medium">{active.title}</Text>
          </HStack>
        )}
      </DragOverlay>
    </DndContext>
  );
}

import { Box, HStack, Text, useSlotRecipe } from "@chakra-ui/react";
import {
  DndContext,
  DragOverlay,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { type DashboardLayoutMode, type DashboardWidget, type GridPlacement, widgetLabel } from "./dashboard-fixtures";
import { measureGrid } from "./dashboard-grid-geometry";
import { GridWidget } from "./dashboard-grid-widget";
import { dashboardColumns, moveWidget, projectWidgets, resizeWidget } from "./dashboard-layout";
import { WidgetIcon } from "./dashboard-widget-icon";
import { useDashboardResize } from "./use-dashboard-resize";

interface GridProps {
  widgets: DashboardWidget[];
  editing: boolean;
  mode: DashboardLayoutMode;
  selectedId: string | null;
  days: number;
  onChange: (widgets: DashboardWidget[]) => void;
  onConfigure: (id: string | null) => void;
  onWidgetChange: (widget: DashboardWidget) => void;
  onRemove: (id: string) => void;
  onGestureStart: () => void;
}
interface DragSession {
  id: string;
  origin: GridPlacement;
  candidate: GridPlacement;
  metrics: { column: number; row: number };
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
  const { widgets, editing, mode, onChange, onGestureStart } = props;
  const grid = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(12);
  const [metrics, setMetrics] = useState<ReturnType<typeof measureGrid> | null>(null);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const projected = projectWidgets(widgets, columns);
  const resizing = useDashboardResize({ widgets, projected, columns, mode, grid, onChange, onGestureStart });
  const preview = drag ? moveWidget(widgets, drag.id, drag.candidate, columns, mode) : widgets;
  const sized = resizing.resize
    ? resizeWidget(preview, resizing.resize.id, resizing.resize.size, columns, mode, resizing.resize.handle)
    : preview;
  const visible = projectWidgets(sized, columns);
  useEffect(() => {
    if (!grid.current) return;
    const element = grid.current;
    const observer = new ResizeObserver(([entry]) => {
      const nextColumns = dashboardColumns(entry.contentRect.width);
      setColumns(nextColumns);
      const next = measureGrid(element, nextColumns);
      setMetrics((previous) =>
        previous?.column === next.column &&
        previous.row === next.row &&
        previous.scale === next.scale &&
        previous.gap === next.gap
          ? previous
          : next,
      );
    });
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
  const rowCount =
    Math.max(1, ...visible.map((widget) => widget.layout.y + widget.layout.h)) + (editing && mode === "free" ? 3 : 0);
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
            resizeController={resizing}
            columns={columns}
            metrics={metrics}
          />
        ))}
      </GridSurface>
      <DragOverlay dropAnimation={null}>
        {active && (
          <HStack layerStyle="floatingBar" pointerEvents="none" data-dashboard-drag-bubble="">
            <WidgetIcon kind={active.kind} />
            <Text textStyle="label/S/medium">{widgetLabel(active)}</Text>
          </HStack>
        )}
      </DragOverlay>
    </DndContext>
  );
}

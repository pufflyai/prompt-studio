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
import { dragAnchor, measureGrid } from "./dashboard-grid-geometry";
import { GridWidget } from "./dashboard-grid-widget";
import { dashboardColumns, previewWidgetMove, projectWidgets, resizeWidget } from "./dashboard-layout";
import {
  type DashboardDataSource,
  type DashboardLayoutMode,
  type DashboardWidget,
  type GridPlacement,
  widgetLabel,
} from "./dashboard-types";
import { WidgetIcon } from "./dashboard-widget-icon";
import { useDashboardResize } from "./use-dashboard-resize";

interface GridProps {
  widgets: DashboardWidget[];
  editing: boolean;
  mode: DashboardLayoutMode;
  selectedId: string | null;
  sources: DashboardDataSource[];
  onChange: (widgets: DashboardWidget[]) => void;
  onConfigure: (id: string | null) => void;
  onWidgetChange: (widget: DashboardWidget) => void;
  onRemove: (id: string) => void;
  onGestureStart: () => void;
}
interface DragSession {
  id: string;
  origin: GridPlacement;
  anchor: { x: number; y: number };
  delta: { x: number; y: number };
  metrics: ReturnType<typeof measureGrid>;
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
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const grid = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(12);
  const [metrics, setMetrics] = useState<ReturnType<typeof measureGrid> | null>(null);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const projected = projectWidgets(widgets, columns);
  const resizing = useDashboardResize({ widgets, projected, columns, mode, grid, onChange, onGestureStart });
  const candidate = drag && {
    ...drag.origin,
    x: Math.max(0, Math.min(columns - drag.origin.w, drag.origin.x + Math.round(drag.delta.x / drag.metrics.column))),
    y: Math.max(0, drag.origin.y + Math.round(drag.delta.y / drag.metrics.row)),
  };
  const move =
    drag && candidate
      ? previewWidgetMove(widgets, drag.id, candidate, columns, mode, {
          position: {
            x: drag.anchor.x + drag.delta.x / drag.metrics.column,
            y: drag.anchor.y + drag.delta.y / drag.metrics.row,
          },
          gapRatio: drag.metrics.gap / drag.metrics.row,
        })
      : null;
  const preview = move?.widgets ?? widgets;
  const sized = resizing.resize
    ? resizeWidget(preview, resizing.resize.id, resizing.resize.size, columns, mode, resizing.resize.handle)
    : preview;
  const visible = projectWidgets(move?.type === "row" ? widgets : sized, columns);
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
      onDragStart={({ active, activatorEvent }) => {
        const widget = projected.find((item) => item.id === active.id);
        if (!widget || !grid.current) return;
        onGestureStart();
        setDrag({
          id: widget.id,
          origin: widget.layout,
          anchor: dragAnchor(grid.current, widget.layout, activatorEvent, columns),
          delta: { x: 0, y: 0 },
          metrics: measureGrid(grid.current, columns),
        });
      }}
      onDragMove={({ delta }) =>
        setDrag(
          (previous) =>
            previous && {
              ...previous,
              delta,
            },
        )
      }
      onDragEnd={({ over }) => {
        if (move && move.type !== "none" && over) onChange(preview);
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
            showDropPreview={move?.type === "widget" && drag?.id === widget.id}
            resizing={resizing.resize?.id === widget.id}
            resizeController={resizing}
            columns={columns}
            metrics={metrics}
          />
        ))}
        {drag && move?.type === "row" && (
          <Box
            aria-hidden
            css={styles.rowDropIndicator}
            data-drop-active
            data-dashboard-row-drop=""
            data-before-widget={move.gap.beforeId ?? ""}
            style={
              {
                "--dashboard-drop-top": `${(move.gap.y * drag.metrics.row - drag.metrics.gap / 2) / drag.metrics.scale}px`,
              } as CSSProperties
            }
          />
        )}
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

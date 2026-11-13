import { type PointerEvent, useRef, useState } from "react";
import type { MarmaladeLayer, MarmaladeState } from "./marmalade.types";
import { MarmaladeArtwork } from "./marmalade-artwork";
import { useMarmaladeGesture } from "./marmalade-gesture";
import { marmaladeLocked } from "./marmalade-layers";
import { marmaladeStore } from "./marmalade-store";

export const MarmaladeCanvasLayer = (props: { layer: MarmaladeLayer; state: MarmaladeState }) => {
  const { layer, state } = props;
  const selected = state.selectedIds.includes(layer.id);
  const locked = marmaladeLocked(state, layer);
  const gesture = useMarmaladeGesture();
  const pointer = useRef<{ x: number; y: number; baseX: number; baseY: number; ids: string[] } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const point = (event: PointerEvent<SVGGElement>) => {
    const matrix = (event.currentTarget.parentElement as unknown as SVGGElement)?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  };
  const start = (event: PointerEvent<SVGGElement>) => {
    if (state.tool !== "move" && !(state.tool === "text" && layer.kind === "text")) return;
    if (locked) return;
    event.stopPropagation();
    event.currentTarget.focus();
    const ids = new Set(state.selectedIds);
    if (event.ctrlKey || event.metaKey) {
      if (ids.has(layer.id)) ids.delete(layer.id);
      else ids.add(layer.id);
    } else if (!ids.has(layer.id)) {
      ids.clear();
      ids.add(layer.id);
    }
    void marmaladeStore.dispatch({ type: "select", ids: [...ids] });
    if (state.tool === "move") {
      gesture.begin("document");
      const origin = point(event);
      pointer.current = { x: origin.x, y: origin.y, baseX: layer.x, baseY: layer.y, ids: [...ids] };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const end = (event: PointerEvent<SVGGElement>) => {
    if (!pointer.current) return;
    const current = point(event);
    const ids = pointer.current.ids;
    const dx = Math.round(current.x - pointer.current.x);
    const dy = Math.round(current.y - pointer.current.y);
    pointer.current = null;
    setOffset({ x: 0, y: 0 });
    if (!dx && !dy) {
      void gesture.cancel();
      return;
    }
    void gesture.complete({
      type: "transform",
      ids,
      dx,
      dy,
    });
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: document artwork uses interactive SVG groups.
    <g
      role="button"
      aria-label={`Canvas layer: ${layer.name}`}
      aria-pressed={selected}
      aria-disabled={locked}
      tabIndex={locked ? -1 : 0}
      transform={`translate(${pointer.current && gesture.isCurrent() ? pointer.current.baseX + offset.x : layer.x} ${pointer.current && gesture.isCurrent() ? pointer.current.baseY + offset.y : layer.y}) rotate(${layer.rotation ?? 0} ${layer.width / 2} ${layer.height / 2})`}
      opacity={layer.opacity}
      onPointerDown={start}
      onPointerMove={(event) => {
        if (pointer.current && gesture.isCurrent()) {
          const next = point(event);
          const delta = { x: next.x - pointer.current.x, y: next.y - pointer.current.y };
          setOffset(delta);
          gesture.update({
            type: "transform",
            ids: pointer.current.ids,
            dx: Math.round(delta.x),
            dy: Math.round(delta.y),
          });
        }
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        void gesture.cancel();
        pointer.current = null;
        setOffset({ x: 0, y: 0 });
      }}
      onKeyDown={(event) => {
        if (locked) return;
        if (event.key === "Escape" && pointer.current) {
          event.preventDefault();
          event.stopPropagation();
          pointer.current = null;
          setOffset({ x: 0, y: 0 });
          void gesture.cancel();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void marmaladeStore.dispatch({ type: "select", ids: [layer.id] });
        }
        const directions: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        const delta = directions[event.key];
        if (delta && state.tool === "move" && !event.altKey) {
          event.preventDefault();
          void marmaladeStore.dispatch({
            type: "transform",
            ids: selected ? state.selectedIds : [layer.id],
            dx: delta[0] * (event.shiftKey ? 10 : 1),
            dy: delta[1] * (event.shiftKey ? 10 : 1),
          });
        }
      }}
    >
      <title>
        {layer.name}
        {locked ? " (locked)" : ""}
      </title>
      <MarmaladeArtwork layer={layer} />
      <rect
        width={layer.width}
        height={layer.height}
        fill="transparent"
        stroke={selected ? "var(--chakra-colors-border-accent)" : "none"}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
};

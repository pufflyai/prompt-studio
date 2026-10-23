import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { type PointerEvent, useRef, useState } from "react";
import type { MarmaladeLayer, MarmaladeState } from "./marmalade.types";
import { marmaladeLayers, marmaladeLocked } from "./marmalade-document";
import { greatWaveImage } from "./marmalade-preview";
import { marmaladeStore, useMarmalade } from "./marmalade-store";

const CanvasLayer = (props: { layer: MarmaladeLayer; state: MarmaladeState }) => {
  const { layer, state } = props;
  const selected = state.selectedIds.includes(layer.id);
  const locked = marmaladeLocked(state, layer);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const point = (event: PointerEvent<SVGGElement>) => {
    const matrix = (event.currentTarget.parentElement as unknown as SVGGElement)?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  };
  const start = (event: PointerEvent<SVGGElement>) => {
    if (state.tool === "hand" || state.tool === "zoom" || locked) return;
    event.stopPropagation();
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
      pointer.current = point(event);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const end = (event: PointerEvent<SVGGElement>) => {
    if (!pointer.current) return;
    const current = point(event);
    const dx = Math.round(current.x - pointer.current.x);
    const dy = Math.round(current.y - pointer.current.y);
    pointer.current = null;
    setOffset({ x: 0, y: 0 });
    if (dx || dy)
      void marmaladeStore.dispatch({
        type: "transform",
        ids: state.selectedIds.includes(layer.id) ? state.selectedIds : [layer.id],
        dx,
        dy,
      });
  };
  return (
    // SVG layers need button semantics; HTML buttons cannot wrap SVG artwork.
    // biome-ignore lint/a11y/useSemanticElements: interactive SVG document layer.
    <g
      role="button"
      aria-label={`Canvas layer: ${layer.name}`}
      aria-pressed={selected}
      aria-disabled={locked}
      tabIndex={locked ? -1 : 0}
      transform={`translate(${layer.x + offset.x} ${layer.y + offset.y})`}
      opacity={layer.opacity}
      onPointerDown={start}
      onPointerMove={(event) => {
        if (pointer.current) {
          const next = point(event);
          setOffset({ x: next.x - pointer.current.x, y: next.y - pointer.current.y });
        }
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        pointer.current = null;
        setOffset({ x: 0, y: 0 });
      }}
      onKeyDown={(event) => {
        if (locked) return;
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
        if (delta && state.tool === "move") {
          event.preventDefault();
          void marmaladeStore.dispatch({
            type: "transform",
            ids: [layer.id],
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
      {layer.kind === "image" ? (
        <image href={greatWaveImage} width={layer.width} height={layer.height} preserveAspectRatio="none" />
      ) : null}
      {layer.kind === "shape" ? <rect width={layer.width} height={layer.height} rx={12} fill="#10263b" /> : null}
      {layer.kind === "text" ? (
        <text
          x={0}
          y={layer.height * 0.8}
          fontFamily="sans-serif"
          style={{ fontSize: layer.id === "title" ? 48 : 23 }}
          fill="#fff"
        >
          {layer.text}
        </text>
      ) : null}
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

export const MarmaladeCanvas = () => {
  const { state, error } = useMarmalade();
  const svg = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState<{ startX: number; startY: number; x: number; y: number; dx: number; dy: number }>();
  const panPoint = (event: PointerEvent<HTMLElement>) => {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  };
  return (
    <Stack h="full" minH="0" gap="0" bg="bg.subtle">
      <HStack px="sm" py="xs" gap="sm" borderBottomWidth="1px" borderColor="border.subtle" flexWrap="wrap">
        <Text textStyle="label/S/medium">{state.document.title}</Text>
        <Text textStyle="label/XS" color="fg.muted">
          {state.tool === "text"
            ? "Select a text layer, then edit Text in Properties"
            : "Move · drag selected layers · arrow keys for precision"}
        </Text>
        <Box flex="1" />
        <Button
          variant="ghost"
          size="xs"
          onClick={() => void marmaladeStore.dispatch({ type: "viewport", zoom: 1, pan: { x: 0, y: 0 } })}
        >
          Fit
        </Button>
      </HStack>
      {error ? (
        <Text role="alert" color="fg.error" px="sm" textStyle="label/XS">
          {error}
        </Text>
      ) : null}
      <Box
        flex="1"
        minH="0"
        minW="0"
        p="lg"
        overflow="hidden"
        onPointerDown={(event) => {
          if (state.tool !== "hand") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = panPoint(event);
          setPan({ startX: point.x, startY: point.y, ...state.pan, dx: 0, dy: 0 });
        }}
        onPointerMove={(event) => {
          if (!pan) return;
          const point = panPoint(event);
          setPan({ ...pan, dx: point.x - pan.startX, dy: point.y - pan.startY });
        }}
        onPointerUp={(event) => {
          if (!pan) return;
          const point = panPoint(event);
          void marmaladeStore.dispatch({
            type: "viewport",
            pan: { x: pan.x + point.x - pan.startX, y: pan.y + point.y - pan.startY },
          });
          setPan(undefined);
        }}
        onPointerCancel={() => setPan(undefined)}
        onClick={(event) => {
          if (state.tool === "zoom")
            void marmaladeStore.dispatch({
              type: "viewport",
              zoom: Math.min(4, Math.max(0.25, state.zoom + (event.altKey ? -0.25 : 0.25))),
            });
        }}
      >
        {state.document.layers.length ? (
          <svg
            ref={svg}
            role="img"
            aria-label="Marmalade document canvas"
            width="100%"
            height="100%"
            viewBox={`0 0 ${state.document.width} ${state.document.height}`}
          >
            <g
              transform={`translate(${pan ? pan.x + pan.dx : state.pan.x} ${pan ? pan.y + pan.dy : state.pan.y}) scale(${state.zoom})`}
            >
              {marmaladeLayers(state).map((layer) => (
                <CanvasLayer key={layer.id} layer={layer} state={state} />
              ))}
            </g>
          </svg>
        ) : (
          <EmptyState title="Your canvas is empty" description="Restore the Great Wave sample from the inspector." />
        )}
      </Box>
    </Stack>
  );
};

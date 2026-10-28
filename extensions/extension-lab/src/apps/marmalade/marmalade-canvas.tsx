import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { EmptyState, Tooltip } from "@pstdio/ui";
import { type PointerEvent, useRef, useState } from "react";
import { ExampleIcon } from "../../icon";
import type { MarmaladeTool } from "./marmalade.types";
import { MarmaladeCanvasLayer } from "./marmalade-canvas-layer";
import { marmaladeLayers } from "./marmalade-layers";
import { marmaladeStore, useMarmalade } from "./marmalade-store";

interface Drawing {
  tool: Extract<MarmaladeTool, "rectangle" | "ellipse" | "brush">;
  points: [number, number][];
}
export const MarmaladeCanvas = () => {
  const { state, error } = useMarmalade();
  const svg = useRef<SVGSVGElement>(null);
  const documentGroup = useRef<SVGGElement>(null);
  const drawing = useRef<Drawing | null>(null);
  const [draft, setDraft] = useState<Drawing>();
  const [pan, setPan] = useState<{ startX: number; startY: number; x: number; y: number; dx: number; dy: number }>();
  const point = (event: PointerEvent, target: SVGSVGElement | SVGGElement | null) => {
    const matrix = target?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  };
  const zoomKey = (event: import("react").KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      void marmaladeStore.dispatch({ type: "viewport", zoom: Math.min(4, state.zoom + 0.25) });
    }
    if (event.key === "-") {
      event.preventDefault();
      void marmaladeStore.dispatch({ type: "viewport", zoom: Math.max(0.25, state.zoom - 0.25) });
    }
  };
  const draftStart = draft?.points[0];
  const draftEnd = draft?.points.at(-1);
  return (
    <Stack h="full" minH="0" gap="0" bg="bg.subtle">
      <HStack px="sm" py="xs" gap="xs" borderBottomWidth="1px" borderColor="border.subtle">
        {(["undo", "redo"] as const).map((type) => (
          <Tooltip key={type} content={type === "undo" ? "Undo" : "Redo"}>
            <IconButton
              aria-label={type === "undo" ? "Undo" : "Redo"}
              size="xs"
              variant="ghost"
              disabled={!state.history[type]}
              onClick={() => void marmaladeStore.dispatch({ type })}
            >
              <ExampleIcon name={type === "undo" ? "Undo2" : "Redo2"} />
            </IconButton>
          </Tooltip>
        ))}
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
        position="relative"
        role="region"
        aria-label="Drawing workspace"
        tabIndex={0}
        onKeyDown={zoomKey}
      >
        <svg
          ref={svg}
          role="application"
          aria-label="Marmalade document canvas"
          width="100%"
          height="100%"
          viewBox={`0 0 ${state.document.width} ${state.document.height}`}
          onPointerDown={(event) => {
            event.currentTarget.parentElement?.focus();
            if (state.tool === "hand") {
              event.currentTarget.setPointerCapture(event.pointerId);
              const next = point(event, svg.current);
              setPan({ startX: next.x, startY: next.y, ...state.pan, dx: 0, dy: 0 });
            } else if (state.tool === "text") {
              const next = point(event, documentGroup.current);
              void marmaladeStore.dispatch({
                type: "create",
                kind: "text",
                x: Math.round(next.x),
                y: Math.round(next.y),
              });
            } else if (state.tool === "rectangle" || state.tool === "ellipse" || state.tool === "brush") {
              const next = point(event, documentGroup.current);
              event.currentTarget.setPointerCapture(event.pointerId);
              drawing.current = { tool: state.tool, points: [[next.x, next.y]] };
              setDraft(drawing.current);
            }
          }}
          onPointerMove={(event) => {
            if (pan) {
              const next = point(event, svg.current);
              setPan({ ...pan, dx: next.x - pan.startX, dy: next.y - pan.startY });
            }
            if (drawing.current) {
              const next = point(event, documentGroup.current);
              const prior = drawing.current;
              const points: [number, number][] =
                prior.tool === "brush" ? [...prior.points, [next.x, next.y]] : [prior.points[0], [next.x, next.y]];
              drawing.current = { ...prior, points };
              setDraft(drawing.current);
            }
          }}
          onPointerUp={(event) => {
            if (pan) {
              const next = point(event, svg.current);
              void marmaladeStore.dispatch({
                type: "viewport",
                pan: { x: pan.x + next.x - pan.startX, y: pan.y + next.y - pan.startY },
              });
              setPan(undefined);
            }
            const current = drawing.current;
            if (!current) return;
            const next = point(event, documentGroup.current);
            const points: [number, number][] = [...current.points, [next.x, next.y]];
            const xs = points.map((p) => p[0]);
            const ys = points.map((p) => p[1]);
            const x = Math.min(...xs);
            const y = Math.min(...ys);
            void marmaladeStore.dispatch({
              type: "create",
              kind: current.tool,
              x,
              y,
              width: Math.max(1, Math.max(...xs) - x),
              height: Math.max(1, Math.max(...ys) - y),
              points: current.tool === "brush" ? points.map((p) => [p[0] - x, p[1] - y]) : undefined,
            });
            drawing.current = null;
            setDraft(undefined);
          }}
          onPointerCancel={() => {
            drawing.current = null;
            setDraft(undefined);
            setPan(undefined);
          }}
          onKeyDown={zoomKey}
          onClick={(event) => {
            if (state.tool === "zoom")
              void marmaladeStore.dispatch({
                type: "viewport",
                zoom: Math.min(4, Math.max(0.25, state.zoom + (event.altKey ? -0.25 : 0.25))),
              });
          }}
        >
          <g
            ref={documentGroup}
            transform={`translate(${pan ? pan.x + pan.dx : state.pan.x} ${pan ? pan.y + pan.dy : state.pan.y}) scale(${state.zoom})`}
          >
            {marmaladeLayers(state).map((layer) => (
              <MarmaladeCanvasLayer key={layer.id} layer={layer} state={state} />
            ))}
            {draftStart && draftEnd && draft?.tool === "brush" ? (
              <polyline
                points={draft.points.map((p) => p.join(",")).join(" ")}
                stroke="#f4b860"
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                pointerEvents="none"
              />
            ) : null}
            {draftStart && draftEnd && draft?.tool === "rectangle" ? (
              <rect
                x={Math.min(draftStart[0], draftEnd[0])}
                y={Math.min(draftStart[1], draftEnd[1])}
                width={Math.abs(draftStart[0] - draftEnd[0])}
                height={Math.abs(draftStart[1] - draftEnd[1])}
                fill="#f4b860"
                pointerEvents="none"
              />
            ) : null}
            {draftStart && draftEnd && draft?.tool === "ellipse" ? (
              <ellipse
                cx={(draftStart[0] + draftEnd[0]) / 2}
                cy={(draftStart[1] + draftEnd[1]) / 2}
                rx={Math.abs(draftStart[0] - draftEnd[0]) / 2}
                ry={Math.abs(draftStart[1] - draftEnd[1]) / 2}
                fill="#f4b860"
                pointerEvents="none"
              />
            ) : null}
          </g>
        </svg>
        {!state.document.layers.length ? (
          <Box position="absolute" inset="0" display="grid" placeItems="center" pointerEvents="none">
            <EmptyState title="No layers" />
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
};

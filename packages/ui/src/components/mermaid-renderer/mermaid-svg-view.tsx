import { Box } from "@chakra-ui/react";
import type { PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { MermaidZoomControls } from "./mermaid-toolbar";
import { createSvgDataUrl } from "./svg-data-url";

interface MermaidSvgViewProps {
  svg: string;
  zoom: number;
  allowPanAtDefaultZoom?: boolean;
  maxHeight?: string;
  minHeight?: string;
  overlayActions?: ReactNode;
  onZoomChange: (zoom: number) => void;
}

export const MermaidSvgView = (props: MermaidSvgViewProps) => {
  const {
    allowPanAtDefaultZoom = false,
    maxHeight = "420px",
    minHeight = "220px",
    overlayActions,
    svg,
    zoom,
    onZoomChange,
  } = props;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ pointerId: -1, x: 0, y: 0 });
  const canPan = allowPanAtDefaultZoom || zoom > 1;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canPan) {
      return;
    }

    panStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!canPan || !isPanning || panStartRef.current.pointerId !== event.pointerId) {
      return;
    }

    setOffset({
      x: event.clientX - panStartRef.current.x,
      y: event.clientY - panStartRef.current.y,
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!canPan || panStartRef.current.pointerId !== event.pointerId) {
      return;
    }

    setIsPanning(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (canPan) {
      return;
    }

    setOffset({ x: 0, y: 0 });
    setIsPanning(false);
  }, [canPan]);

  return (
    <Box
      data-testid="mermaid-diagram-surface"
      position="relative"
      minHeight={minHeight}
      maxHeight={maxHeight}
      overflow="hidden"
      cursor={canPan ? (isPanning ? "grabbing" : "grab") : "default"}
      touchAction={canPan ? "none" : "auto"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        setIsPanning(false);
      }}
    >
      <Box
        data-testid="mermaid-diagram-transform"
        data-pan-enabled={canPan ? "true" : "false"}
        width="100%"
        maxHeight={maxHeight}
        textAlign="center"
        transform={`translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`}
        transformOrigin="top left"
        cursor={canPan ? (isPanning ? "grabbing" : "grab") : "default"}
        css={{
          "& img": {
            display: "inline-block",
            width: "auto",
            maxWidth: "100%",
            maxHeight,
            height: "auto",
            userSelect: "none",
          },
        }}
      >
        <img alt="Mermaid diagram" draggable={false} src={createSvgDataUrl(svg)} />
      </Box>
      {overlayActions}
      <MermaidZoomControls zoom={zoom} onZoomChange={onZoomChange} />
    </Box>
  );
};

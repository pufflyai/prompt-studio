import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { downloadMermaidPng } from "./download-png";
import { MermaidErrorState } from "./mermaid-error-state";
import { MermaidFullscreen } from "./mermaid-fullscreen";
import { MermaidSvgView } from "./mermaid-svg-view";
import { MermaidInlineToolbar } from "./mermaid-toolbar";
import { useMermaidRender } from "./use-mermaid-render";

export interface MermaidRendererProps {
  code: string;
  initialFullscreenOpen?: boolean;
  initialZoom?: number;
  isEditable?: boolean;
  onRequestEdit?: () => void;
}

interface MermaidPreviewContentProps {
  allowPanAtDefaultZoom?: boolean;
  code: string;
  error: string;
  isRendering: boolean;
  maxHeight?: string;
  minHeight?: string;
  overlayActions?: ReactNode;
  svg: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const MermaidPreviewContent = (props: MermaidPreviewContentProps) => {
  const {
    allowPanAtDefaultZoom,
    code,
    error,
    isRendering,
    maxHeight,
    minHeight,
    overlayActions,
    svg,
    zoom,
    onZoomChange,
  } = props;

  if (isRendering) {
    return (
      <Box position="relative" minHeight={minHeight ?? "220px"} maxHeight={maxHeight} overflow="hidden">
        <Text color="fg.muted" textStyle="paragraph/S/regular">
          Rendering diagram...
        </Text>
        {overlayActions}
      </Box>
    );
  }

  if (error) {
    return (
      <Box position="relative" minHeight={minHeight ?? "220px"} maxHeight={maxHeight} overflow="hidden">
        <MermaidErrorState code={code} error={error} />
        {overlayActions}
      </Box>
    );
  }

  return (
    <MermaidSvgView
      key={svg}
      allowPanAtDefaultZoom={allowPanAtDefaultZoom}
      maxHeight={maxHeight}
      minHeight={minHeight}
      overlayActions={overlayActions}
      svg={svg}
      zoom={zoom}
      onZoomChange={onZoomChange}
    />
  );
};

export const MermaidRenderer = (props: MermaidRendererProps) => {
  const { code, initialFullscreenOpen = false, initialZoom = 1, isEditable = false, onRequestEdit } = props;
  const { svg, error, isRendering } = useMermaidRender(code);
  const [inlineZoom, setInlineZoom] = useState(initialZoom);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(initialFullscreenOpen);
  const previousResetValuesRef = useRef({ code, initialZoom });
  const canDownload = Boolean(svg) && !error && !isRendering;

  useEffect(() => {
    const previousResetValues = previousResetValuesRef.current;
    if (previousResetValues.code === code && previousResetValues.initialZoom === initialZoom) {
      return;
    }

    previousResetValuesRef.current = { code, initialZoom };
    setInlineZoom(initialZoom);
    setFullscreenZoom(1);
  }, [code, initialZoom]);

  const openFullscreen = () => {
    setFullscreenZoom(1);
    setIsFullscreenOpen(true);
  };

  return (
    <Box width="100%">
      <MermaidPreviewContent
        code={code}
        error={error}
        isRendering={isRendering}
        overlayActions={
          <MermaidInlineToolbar
            isEditable={isEditable}
            onRequestEdit={onRequestEdit}
            onOpenFullscreen={openFullscreen}
          />
        }
        svg={svg}
        zoom={inlineZoom}
        onZoomChange={setInlineZoom}
      />
      <MermaidFullscreen
        open={isFullscreenOpen}
        canDownload={canDownload}
        onClose={() => setIsFullscreenOpen(false)}
        onDownload={() => downloadMermaidPng({ svg, zoom: fullscreenZoom })}
      >
        <MermaidPreviewContent
          allowPanAtDefaultZoom
          code={code}
          error={error}
          isRendering={isRendering}
          maxHeight="100%"
          minHeight="100%"
          svg={svg}
          zoom={fullscreenZoom}
          onZoomChange={setFullscreenZoom}
        />
      </MermaidFullscreen>
    </Box>
  );
};

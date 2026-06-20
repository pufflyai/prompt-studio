import { Box, Text } from "@chakra-ui/react";
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
  code: string;
  error: string;
  isRendering: boolean;
  minHeight?: string;
  svg: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const MermaidPreviewContent = (props: MermaidPreviewContentProps) => {
  const { code, error, isRendering, minHeight, svg, zoom, onZoomChange } = props;

  if (isRendering) {
    return (
      <Box borderRadius="sm" bg="bg.panel" p="sm" minHeight={minHeight}>
        <Text color="fg.muted" textStyle="paragraph/S/regular">
          Rendering diagram...
        </Text>
      </Box>
    );
  }

  if (error) {
    return <MermaidErrorState code={code} error={error} />;
  }

  return <MermaidSvgView key={svg} svg={svg} zoom={zoom} minHeight={minHeight} onZoomChange={onZoomChange} />;
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
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden" width="100%">
      <MermaidInlineToolbar isEditable={isEditable} onRequestEdit={onRequestEdit} onOpenFullscreen={openFullscreen} />
      <Box bg="bg.muted" px="sm" pb="sm">
        <MermaidPreviewContent
          code={code}
          error={error}
          isRendering={isRendering}
          svg={svg}
          zoom={inlineZoom}
          onZoomChange={setInlineZoom}
        />
      </Box>
      <MermaidFullscreen
        open={isFullscreenOpen}
        canDownload={canDownload}
        onClose={() => setIsFullscreenOpen(false)}
        onDownload={() => downloadMermaidPng({ svg, zoom: fullscreenZoom })}
      >
        <MermaidPreviewContent
          code={code}
          error={error}
          isRendering={isRendering}
          minHeight="100%"
          svg={svg}
          zoom={fullscreenZoom}
          onZoomChange={setFullscreenZoom}
        />
      </MermaidFullscreen>
    </Box>
  );
};

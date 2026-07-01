import { Icon, IconButton, Stack } from "@chakra-ui/react";
import { Maximize2, Minus, Pencil, Plus } from "lucide-react";
import { Tooltip } from "@/components/primitives/tooltip";
import { MERMAID_MAX_ZOOM, MERMAID_MIN_ZOOM, zoomIn, zoomOut } from "./mermaid-zoom";

interface MermaidInlineToolbarProps {
  isEditable: boolean;
  onRequestEdit?: () => void;
  onOpenFullscreen: () => void;
}

interface MermaidZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export const MermaidInlineToolbar = (props: MermaidInlineToolbarProps) => {
  const { isEditable, onRequestEdit, onOpenFullscreen } = props;

  return (
    <Stack
      data-testid="mermaid-inline-toolbar"
      direction="row"
      justify="flex-end"
      align="center"
      gap="xs"
      position="absolute"
      top="sm"
      right="sm"
      zIndex="1"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {isEditable && onRequestEdit ? (
        <Tooltip content="Edit source">
          <IconButton aria-label="Edit" size="xs" variant="subtle" onClick={onRequestEdit}>
            <Icon as={Pencil} boxSize="14px" />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip content="Open diagram">
        <IconButton aria-label="Open diagram" size="xs" variant="subtle" onClick={onOpenFullscreen}>
          <Icon as={Maximize2} boxSize="14px" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

export const MermaidZoomControls = (props: MermaidZoomControlsProps) => {
  const { zoom, onZoomChange } = props;

  return (
    <Stack
      data-testid="mermaid-zoom-controls"
      gap="2xs"
      position="absolute"
      right="sm"
      bottom="sm"
      zIndex="1"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Tooltip content="Zoom in">
        <IconButton
          aria-label="Zoom in"
          size="xs"
          variant="subtle"
          onClick={() => onZoomChange(zoomIn(zoom))}
          disabled={zoom >= MERMAID_MAX_ZOOM}
        >
          <Icon as={Plus} boxSize="14px" />
        </IconButton>
      </Tooltip>
      <Tooltip content="Zoom out">
        <IconButton
          aria-label="Zoom out"
          size="xs"
          variant="subtle"
          onClick={() => onZoomChange(zoomOut(zoom))}
          disabled={zoom <= MERMAID_MIN_ZOOM}
        >
          <Icon as={Minus} boxSize="14px" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};
